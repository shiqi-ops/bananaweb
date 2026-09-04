"""
Dify workflow client for the 新模式 (Dify 生成) feature.

调用 Dify 已发布的工作流 API，返回一份成品 PPTX 文件（或可转为 PPTX 的内容）。

环境变量:
    DIFY_API_BASE       Dify API 基础地址，形如 https://your-dify.example.com/v1
                        （自部署一般形如 http://host:port/v1）
    DIFY_API_KEY        发布工作流后在「API 访问」页拿到的 API Key
    DIFY_TIMEOUT        请求超时秒数，默认 600（Dify 工作流生成 PPT 可能较慢）

说明:
    - 未配置 DIFY_API_BASE / DIFY_API_KEY 时 is_dify_configured() 返回 False，
      上层将使用占位实现（本地模板生成 PPTX），保证整条链路可以先跑通；
      配置完成后无需改动任何代码即切换到真实 Dify 生成。
    - 工作流 outputs 支持三种返回形态：
        1) 文件变量（插件/工具返回的 .pptx 文件 URL）→ 自动下载为本地文件
        2) markdown / 文本内容 → 返回文本，由上层本地排版成 PPTX
        3) 结构化 JSON（含 pages）→ 返回文本，由上层解析后排版
"""
import logging
import os
import re
import tempfile

import requests

logger = logging.getLogger(__name__)

_ENV_BASE = 'DIFY_API_BASE'
_ENV_KEY = 'DIFY_API_KEY'
_ENV_TIMEOUT = 'DIFY_TIMEOUT'


def is_dify_configured() -> bool:
    """是否已配置 Dify（配置后才走真实工作流）。"""
    return bool(
        os.getenv(_ENV_BASE, '').strip()
        and os.getenv(_ENV_KEY, '').strip()
    )


def dify_config_summary() -> str:
    """给前端/日志展示的 Dify 配置状态说明。"""
    if not is_dify_configured():
        return '未配置 DIFY_API_BASE / DIFY_API_KEY（当前使用占位实现）'
    return f"已配置 Dify: {os.getenv(_ENV_BASE, '').strip()}"


def _normalize_base(base: str) -> str:
    base = base.rstrip('/')
    # 允许用户填 https://host/v1 或 https://host（自动补 /v1）
    if not re.search(r'/v1/?$', base):
        base = base + '/v1'
    return base


def _timeout() -> int:
    try:
        return int(os.getenv(_ENV_TIMEOUT, '600').strip() or '600')
    except ValueError:
        return 600


def _proxies() -> dict | None:
    """Dify 请求代理（可选）。设置 DIFY_PROXY 后走代理，例如 http://127.0.0.1:7890。

    用于 api.dify.ai 被墙的场景：本地有代理即可绕过。"""
    proxy = os.getenv('DIFY_PROXY', '').strip()
    if proxy:
        return {'http': proxy, 'https': proxy}
    return None


def _iter_urls(obj, depth: int = 0):
    """深度遍历 outputs，收集可能指向文件的 http(s) URL。"""
    if depth > 6:
        return
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _iter_urls(v, depth + 1)
    elif isinstance(obj, list):
        for item in obj:
            yield from _iter_urls(item, depth + 1)
    elif isinstance(obj, str) and obj.startswith('http'):
        yield obj


def _looks_like_pptx_url(url: str) -> bool:
    lower = url.lower()
    path = url.split('?', 1)[0]
    if '.pptx' in lower or '.ppt' in path.lower():
        return True
    # Dify 文件变量一般形如 {base}/files/tools/xxx
    return '/files/' in lower or '/file/' in lower


def _download_pptx(url: str, api_key: str):
    """下载 URL 内容，校验是合法 zip（pptx 本质是 zip）。返回临时文件路径或 None。"""
    try:
        headers = {'Authorization': f'Bearer {api_key}'}
        resp = requests.get(url, headers=headers, timeout=_timeout(), proxies=_proxies())
        resp.raise_for_status()
        data = resp.content
        if not data or len(data) < 1000 or data[:2] != b'PK':
            logger.warning(f"Dify 返回的 URL 内容不是合法 PPTX: {url} (size={len(data)})")
            return None
        fd, tmp = tempfile.mkstemp(suffix='.pptx')
        os.close(fd)
        with open(tmp, 'wb') as f:
            f.write(data)
        return tmp
    except Exception as e:
        logger.warning(f"下载 Dify 文件失败 {url}: {e}")
        return None


def _extract_content_text(outputs) -> str | None:
    """从 outputs 里找 markdown / 文本内容。"""
    if isinstance(outputs, str):
        return outputs.strip() or None
    if not isinstance(outputs, dict):
        return None
    for key in ('markdown', 'md', 'content', 'text', 'output_text', 'result_text', 'slides', 'pages'):
        val = outputs.get(key)
        if isinstance(val, str) and len(val.strip()) > 20:
            return val.strip()
    # JSON 序列化兜底（如结构化 pages）
    try:
        import json
        if outputs:
            return json.dumps(outputs, ensure_ascii=False)
    except Exception:
        pass
    return None


def enrich_with_dify(instruction: str, title: str = '', style: str = '',
                     usage_scenario: str = '', page_count: int = 1) -> str:
    """
    通用"内容/描述先经 Dify 加工"能力（供 单页生图、素材生成 等场景）。

    把一条指令映射到工作流输入，调用后返回 Dify 产出的文本内容（markdown/json）。
    - 未配置 Dify 时返回 ''，调用方应回退到原引擎（传统模式）。
    - 调用失败时抛出 RuntimeError，由调用方决定如何处理。

    约定（与新模式一致）：requirement=指令；page_count 默认 1。
    """
    if not is_dify_configured():
        return ''
    inputs = {
        'requirement': instruction or '',
        'title': title or '',
        'page_count': int(page_count or 1),
        'usage_scenario': usage_scenario or '',
        'style_description': style or '',
    }
    result = run_dify_workflow(inputs)
    return (result.get('text') or '').strip()


def run_dify_workflow(inputs: dict, user: str = 'banana-slides') -> dict:
    """
    阻塞式调用 Dify 工作流。

    返回:
        {'source': 'file',    'file_path': <临时pptx路径>}
        {'source': 'content', 'text': <markdown/json文本>}
        {'source': 'none',    'note': '...'}

    失败时抛出 RuntimeError（带 Dify 侧错误信息）。
    """
    base = _normalize_base(os.getenv(_ENV_BASE, '').strip())
    api_key = os.getenv(_ENV_KEY, '').strip()
    if not base or not api_key:
        raise RuntimeError('Dify 未配置: 缺少 DIFY_API_BASE / DIFY_API_KEY')

    url = f"{base}/workflows/run"
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'inputs': inputs or {},
        'response_mode': 'blocking',
        'user': user,
    }

    logger.info(f"调用 Dify 工作流: {url} inputs={list((inputs or {}).keys())}")
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=_timeout(), proxies=_proxies())
    except requests.exceptions.Timeout:
        raise RuntimeError(f'Dify 工作流调用超时（>{_timeout()}s），请检查 DIFY_TIMEOUT 或工作流耗时')
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f'Dify 工作流调用失败（网络错误）: {e}')

    if resp.status_code != 200:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text[:500]
        raise RuntimeError(f'Dify 工作流返回错误 HTTP {resp.status_code}: {detail}')

    try:
        payload_data = resp.json()
    except Exception:
        raise RuntimeError(f'Dify 返回内容不是合法 JSON: {resp.text[:500]}')

    data = payload_data.get('data', payload_data) or {}
    outputs = data.get('outputs') or {}
    status = str(data.get('status', 'succeeded')).lower()
    if status in ('failed', 'error', 'stopped'):
        err = data.get('error') or data.get('message') or str(outputs)[:300]
        raise RuntimeError(f'Dify 工作流执行失败: {err}')

    # 1) 先取文本内容（markdown / JSON），供上层做"逐页 AI 渲染"使用
    text = _extract_content_text(outputs)

    # 2) 同时尝试从 outputs 中找 .pptx 文件 URL 并下载（作为兜底交付物）
    seen = set()
    for u in _iter_urls(outputs):
        if u in seen:
            continue
        seen.add(u)
        if _looks_like_pptx_url(u):
            tmp = _download_pptx(u, api_key)
            if tmp:
                logger.info(f"Dify 工作流返回 PPTX 文件: {u}")
                return {'source': 'file', 'file_path': tmp, 'text': text or ''}

    # 3) 有文本内容则直接返回内容
    if text:
        return {'source': 'content', 'text': text}

    # 4) 都没有 → 尽力给出可读错误
    raise RuntimeError(
        f'Dify 工作流已完成，但 outputs 中既没有 .pptx 文件也没有文本内容。'
        f'请确认工作流结束节点输出的是「文件(pptx)」或「文本(markdown)」变量。原始 outputs: {str(outputs)[:300]}'
    )
