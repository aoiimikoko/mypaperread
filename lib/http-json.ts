export async function readJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    if (response.status === 429) throw new Error("模型平台请求过于频繁，请稍后重试");
    if (response.status >= 500) throw new Error(`翻译服务暂时不可用（HTTP ${response.status}），请稍后重试`);
    throw new Error(`接口返回了无法识别的内容（HTTP ${response.status}）`);
  }
}
