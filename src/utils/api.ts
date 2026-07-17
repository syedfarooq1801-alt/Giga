import { API_URL } from '../constants';

export interface ApiResult<T> {
  success: boolean;
  data?: T;
}

export const api = {
  async get<T>(path: string): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${API_URL}${path}`);
      if (!res.ok) return { success: false };
      const json = (await res.json()) as T;
      return { success: true, data: json };
    } catch {
      return { success: false };
    }
  },
};
