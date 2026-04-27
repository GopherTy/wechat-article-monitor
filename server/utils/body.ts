import { H3Event } from 'h3';

/**
 * 手动读取大文件请求体，绕过内置的 body 大小限制
 */
export async function readLargeBody(event: H3Event): Promise<any> {
  const bodyString = await new Promise<string>((resolve, reject) => {
    let data = '';
    event.node.req.on('data', chunk => {
      data += chunk.toString();
    });
    event.node.req.on('end', () => resolve(data));
    event.node.req.on('error', err => reject(err));
  });

  if (!bodyString) {
    return {};
  }
  
  try {
    return JSON.parse(bodyString);
  } catch (err) {
    throw createError({ statusCode: 400, message: 'Invalid JSON body' });
  }
}
