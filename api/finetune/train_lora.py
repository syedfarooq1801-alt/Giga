"""Trains one LoRA adapter per persona on Qwen2.5-1.5B-Instruct, using the
distillation dataset from generate_data.py.

Per-persona adapters (not one shared adapter across all 5 personas): a
single small-rank adapter risks voice bleed between personas with
overlapping style cues (roast_bhai/jugadu_bhai both lean witty/practical).
peft's load_adapter/set_adapter makes swapping between them cheap at serve
time (api/local_llm.py) -- the base model stays resident in VRAM, only the
small adapter changes.

Model/method: Qwen2.5-1.5B-Instruct, plain LoRA in bf16 -- not QLoRA/4-bit.
At this model size (~3GB weights in bf16), a 6GB GPU has comfortable
headroom without needing bitsandbytes, whose Windows support has
historically been flaky. Only the LoRA adapter (a few percent of total
params) trains; the base model's weights stay frozen.

Run with THIS venv's Python (api/finetune/.venv), not the main app's:
    .venv/Scripts/python.exe train_lora.py --dry-run          # 1 persona, 5 examples, 1 epoch
    .venv/Scripts/python.exe train_lora.py                     # full run, all personas
    .venv/Scripts/python.exe train_lora.py --personas ceo_bhai
"""

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch  # noqa: E402
from datasets import Dataset  # noqa: E402
from peft import LoraConfig, get_peft_model  # noqa: E402
from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments  # noqa: E402

from personalities import PERSONALITIES, get_personality_context  # noqa: E402

BASE_MODEL = "Qwen/Qwen2.5-1.5B-Instruct"
DATA_DIR = Path(__file__).parent / "data"
MODELS_DIR = Path(__file__).parent / "models"
MAX_LENGTH = 768  # persona system prompts run ~150-250 tokens; generous headroom for prompt+response


def load_persona_examples(persona_id: str) -> list:
    path = DATA_DIR / f"{persona_id}.jsonl"
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f]


def tokenize_example(tokenizer, system_prompt: str, prompt: str, response: str) -> dict:
    """Builds the full chat-formatted sequence and masks loss to only the
    assistant's response tokens -- the model shouldn't be trained to
    predict the (fixed, always-the-same) system prompt or the user's turn,
    only to generate the persona's reply."""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt},
    ]
    prompt_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    full_text = tokenizer.apply_chat_template(
        messages + [{"role": "assistant", "content": response}], tokenize=False, add_generation_prompt=False
    )

    full = tokenizer(full_text, truncation=True, max_length=MAX_LENGTH, padding="max_length")
    prompt_len = len(tokenizer(prompt_text, truncation=True, max_length=MAX_LENGTH)["input_ids"])

    labels = list(full["input_ids"])
    for i in range(len(labels)):
        if i < prompt_len or full["attention_mask"][i] == 0:
            labels[i] = -100
    full["labels"] = labels
    return full


def train_persona(persona_id: str, epochs: int, limit: int = None) -> None:
    print(f"\n=== Training LoRA adapter for {persona_id} ===", flush=True)
    examples = load_persona_examples(persona_id)
    if limit:
        examples = examples[:limit]
    system_prompt = get_personality_context(persona_id)[0]["content"]

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    tokenized = [tokenize_example(tokenizer, system_prompt, ex["prompt"], ex["response"]) for ex in examples]
    dataset = Dataset.from_list(tokenized)

    model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=torch.bfloat16)
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()  # required for LoRA + gradient checkpointing to actually flow gradients

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    out_dir = MODELS_DIR / persona_id
    training_args = TrainingArguments(
        output_dir=str(out_dir / "checkpoints"),
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        num_train_epochs=epochs,
        learning_rate=2e-4,
        bf16=True,
        logging_steps=10,
        save_strategy="no",
        report_to=[],
        optim="adamw_torch",
    )

    trainer = Trainer(model=model, args=training_args, train_dataset=dataset)
    trainer.train()

    out_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))
    print(f"Saved adapter to {out_dir}", flush=True)

    del model, trainer
    torch.cuda.empty_cache()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train per-persona LoRA adapters on Qwen2.5-1.5B-Instruct.")
    parser.add_argument("--personas", type=str, default=None, help="Comma-separated persona ids (default: all).")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--limit", type=int, default=None, help="Cap examples per persona (for a quick smoke test).")
    parser.add_argument("--dry-run", action="store_true", help="1 persona, 5 examples, 1 epoch -- pipeline sanity check.")
    args = parser.parse_args()

    if args.dry_run:
        personas = [next(iter(PERSONALITIES.keys()))]
        epochs, limit = 1, 5
    else:
        personas = args.personas.split(",") if args.personas else list(PERSONALITIES.keys())
        epochs, limit = args.epochs, args.limit

    for pid in personas:
        if pid not in PERSONALITIES:
            print(f"Skipping unknown persona: {pid}")
            continue
        train_persona(pid, epochs=epochs, limit=limit)

    print("\nAll requested personas trained.")
