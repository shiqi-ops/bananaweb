"""
Diagnosis Service - AI PPT 诊断后台任务

用法:
    from services.task_manager import task_manager
    from services.diagnosis_service import run_diagnosis_task
    task_manager.submit_task(task.id, run_diagnosis_task, task.id, app)
"""
import io
import json
import logging
import os
import re
import tempfile
import traceback
from datetime import datetime

from models import db, DiagnosisTask

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Prompt 模板
# ---------------------------------------------------------------------------

def _diagnosis_page_prompt(page_num: int, diagnosis_options: list) -> str:
    """生成单页诊断的 AI prompt"""
    hints = []
    if "layout" in diagnosis_options:
        hints.append("- 排版布局：检查元素对齐、间距、留白、信息层级是否合理")
    if "color" in diagnosis_options:
        hints.append("- 配色方案：检查对比度、色彩和谐度、文字可读性")
    if "logic" in diagnosis_options:
        hints.append("- 内容逻辑：检查论证链条、信息结构、观点是否清晰")
    if "text" in diagnosis_options:
        hints.append("- 文字表达：检查措辞是否精炼、有无冗余、可读性如何")

    hints_block = "\n".join(hints)

    return f"""你是资深的PPT设计评审专家。请诊断第{page_num}页幻灯片。

重点检查：
{hints_block}

输出严格的JSON格式（不要markdown代码块标记）：
{{
  "layout_issues": [
    {{
      "severity": "high|medium|low",
      "description": "问题描述",
      "suggestion": "改进建议",
      "bbox": {{"x": 0, "y": 0, "width": 0, "height": 0}}
    }}
  ],
  "color_issues": [
    {{
      "severity": "high|medium|low",
      "description": "问题描述",
      "suggestion": "改进建议",
      "affected_element": "元素名称"
    }}
  ],
  "logic_issues": [
    {{
      "severity": "high|medium|low",
      "description": "问题描述",
      "suggestion": "改进建议"
    }}
  ],
  "text_suggestions": [
    {{
      "original": "原文片段",
      "suggested": "建议改为",
      "reason": "修改理由"
    }}
  ]
}}

规则：只输出JSON，不要任何解释。无问题的维度返回空数组[]。每个维度最多3条。
severity只能是high/medium/low。bbox基于图片实际像素位置估算。"""


def _diagnosis_summary_prompt(all_page_results: list) -> str:
    """生成整体评分摘要的 AI prompt"""
    total_issues = 0
    lines = [f"共诊断 {len(all_page_results)} 页。逐页统计:"]
    for i, pr in enumerate(all_page_results, 1):
        n = sum(len(pr.get(k, [])) for k in
                 ["layout_issues", "color_issues", "logic_issues", "text_suggestions"])
        total_issues += n
        lines.append(f"  第{i}页: {n} 个问题")

    details = "\n".join(lines)

    return f"""你是资深的PPT设计评审专家。以下是逐页诊断结果汇总。

{details}

请给出:
1. 整体评分（0-100的整数，综合考虑问题数量和严重程度）
2. 整体摘要（100字以内，概括主要问题和改进方向）

输出严格JSON（不要markdown代码块标记）:
{{"score": 72, "summary": "整体评价..."}}"""


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------

def _pptx_to_pdf(pptx_path: str) -> str | None:
    """用 LibreOffice 将 PPTX 转成 PDF，返回 PDF 路径，失败返回 None"""
    import subprocess
    import shutil

    soffice = r"C:\Program Files\LibreOffice\program\soffice.exe"
    if not os.path.exists(soffice):
        logger.warning("LibreOffice 未安装，无法转换 PPTX")
        return None

    output_dir = os.path.dirname(pptx_path)
    try:
        result = subprocess.run(
            [soffice, "--headless", "--convert-to", "pdf", "--outdir", output_dir, pptx_path],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            logger.warning(f"PPTX 转 PDF 失败: {result.stderr}")
            return None
    except Exception as e:
        logger.warning(f"执行 LibreOffice 失败: {e}")
        return None

    pdf_path = os.path.splitext(pptx_path)[0] + ".pdf"
    if os.path.exists(pdf_path):
        return pdf_path
    return None


def _render_page_to_image(file_path: str, file_type: str, page_num: int):
    """用PyMuPDF渲染指定页为PIL Image，返回Image或None"""
    try:
        import fitz
        from PIL import Image

        pdf_path = file_path
        if file_type == "pptx":
            # 先尝试同名 PDF，没有就用 LibreOffice 转换
            candidate = os.path.splitext(file_path)[0] + ".pdf"
            if os.path.exists(candidate):
                pdf_path = candidate
            else:
                pdf_path = _pptx_to_pdf(file_path)
                if not pdf_path:
                    return None

        doc = fitz.open(pdf_path)
        if page_num < 1 or page_num > len(doc):
            doc.close()
            return None
        page = doc[page_num - 1]
        pix = page.get_pixmap(dpi=150)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        doc.close()
        return img
    except Exception as e:
        logger.warning(f"渲染第{page_num}页失败: {e}")
        return None


def _count_pages(file_path: str, file_type: str) -> int:
    """获取文件总页数"""
    if file_type == "pptx":
        try:
            from pptx import Presentation
            prs = Presentation(file_path)
            return len(prs.slides)
        except Exception as e:
            logger.warning(f"PPTX读取页数失败: {e}")
            return 0

    try:
        import fitz
        doc = fitz.open(file_path)
        count = len(doc)
        doc.close()
        return count
    except Exception:
        return 0


def _parse_json(text: str) -> dict:
    """从AI返回文本中提取JSON对象，带容错"""
    text = text.strip()
    # 去掉 markdown 代码块
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    # 直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 正则兜底：找第一个 JSON 对象
    m = re.search(r'\{.*\}', text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass

    logger.warning(f"无法解析诊断JSON，原文前200字符: {text[:200]}")
    return {}


def _diagnose_single_page(ai_service, img, page_num: int,
                           diagnosis_options: list, tmp_dir: str) -> dict:
    """诊断单页：存临时文件 → 调AI → 解析JSON → 清理临时文件"""
    tmp_path = None
    try:
        # 压缩图片以节省token
        img.thumbnail((1920, 1080))

        # 存临时文件（_generate_text_from_image 需要文件路径）
        fd, tmp_path = tempfile.mkstemp(suffix=".png", dir=tmp_dir)
        os.close(fd)
        img.save(tmp_path, format="PNG")

        # 调AI诊断
        prompt = _diagnosis_page_prompt(page_num, diagnosis_options)
        response_text = ai_service._generate_text_from_image(prompt, tmp_path)

        # 解析结果
        result = _parse_json(response_text)
        result["page_number"] = page_num
        return result
    except Exception as e:
        logger.error(f"AI诊断第{page_num}页失败: {e}")
        return {
            "page_number": page_num,
            "layout_issues": [],
            "color_issues": [],
            "logic_issues": [],
            "text_suggestions": [],
            "_error": str(e),
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def _generate_summary(ai_service, all_page_results: list) -> dict:
    """汇总所有页诊断结果，调AI生成评分和摘要"""
    try:
        prompt = _diagnosis_summary_prompt(all_page_results)
        response_text = ai_service.text_provider.generate_text(prompt)
        result = _parse_json(response_text)
        return result
    except Exception as e:
        logger.error(f"生成诊断摘要失败: {e}")
        # 兜底：简单计算评分
        total_issues = sum(
            len(pr.get(k, [])) for pr in all_page_results
            for k in ["layout_issues", "color_issues", "logic_issues", "text_suggestions"]
        )
        avg = total_issues / max(len(all_page_results), 1)
        score = max(40, min(95, int(100 - avg * 10)))
        return {
            "score": score,
            "summary": f"共诊断{len(all_page_results)}页，发现{total_issues}个优化点。"
        }


# ---------------------------------------------------------------------------
# 后台任务入口
# ---------------------------------------------------------------------------

def run_diagnosis_task(task_id: str, app):
    """
    后台执行AI PPT诊断。

    流程:
      1. DiagnosisTask.status = PROCESSING
      2. 逐页: 渲染图片 → AI诊断 → 解析JSON
      3. 汇总所有页 → AI生成评分+摘要
      4. 写入result JSON → status = COMPLETED
      5. 出错 → status = FAILED + error_message
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")

    with app.app_context():
        diagnosis = None
        tmp_dir = None
        try:
            # ---- 1. 获取任务 ----
            diagnosis = DiagnosisTask.get_by_id(task_id)
            if diagnosis is None:
                logger.error(f"诊断任务{task_id}不存在")
                return

            diagnosis.status = "PROCESSING"
            db.session.commit()
            logger.info(f"诊断{task_id}: 开始处理 {diagnosis.file_path}")

            # ---- 2. 获取AI服务 ----
            from services.ai_service_manager import get_ai_service
            ai_service = get_ai_service()

            # ---- 3. 解析诊断选项 ----
            try:
                options = json.loads(diagnosis.diagnosis_options)
            except (json.JSONDecodeError, TypeError):
                options = ["layout", "color", "logic", "text"]

            # ---- 4. 获取总页数 ----
            total_pages = _count_pages(diagnosis.file_path, diagnosis.file_type)
            if total_pages == 0:
                raise ValueError(f"无法读取文件或文件为空: {diagnosis.file_path}")

            logger.info(f"诊断{task_id}: 共{total_pages}页, 维度: {options}")

            # 准备临时目录
            tmp_dir = os.path.join(app.config["UPLOAD_FOLDER"], "_diagnosis_tmp")
            os.makedirs(tmp_dir, exist_ok=True)

            # ---- 5. 逐页诊断 ----
            all_page_results = []
            for page_num in range(1, total_pages + 1):
                logger.info(f"诊断{task_id}: 第{page_num}/{total_pages}页")

                img = _render_page_to_image(
                    diagnosis.file_path, diagnosis.file_type, page_num
                )
                if img is None:
                    logger.warning(f"第{page_num}页渲染失败，跳过")
                    all_page_results.append({
                        "page_number": page_num,
                        "layout_issues": [],
                        "color_issues": [],
                        "logic_issues": [],
                        "text_suggestions": [],
                        "_render_error": True,
                    })
                    continue

                page_result = _diagnose_single_page(
                    ai_service, img, page_num, options, tmp_dir
                )
                all_page_results.append(page_result)

            # ---- 6. 汇总评分 ----
            logger.info(f"诊断{task_id}: 生成整体摘要")
            summary = _generate_summary(ai_service, all_page_results)

            # ---- 7. 写入最终结果 ----
            final_result = {
                "summary": summary.get("summary", ""),
                "score": summary.get("score", 70),
                "pages": all_page_results,
                "diagnosed_at": datetime.utcnow().isoformat(),
                "diagnosis_options": options,
                "total_pages": total_pages,
            }

            diagnosis.result = json.dumps(final_result, ensure_ascii=False)
            diagnosis.status = "COMPLETED"
            diagnosis.completed_at = datetime.utcnow()
            db.session.commit()

            logger.info(f"诊断{task_id}完成: 评分{summary.get('score')}/100")

        except Exception as e:
            logger.error(f"诊断{task_id}失败: {traceback.format_exc()}")
            try:
                if diagnosis:
                    diagnosis.status = "FAILED"
                    diagnosis.error_message = str(e)
                    diagnosis.completed_at = datetime.utcnow()
                    db.session.commit()
            except Exception as db_err:
                logger.error(f"更新失败状态时出错: {db_err}")
                db.session.rollback()
        finally:
            # 清理临时目录
            if tmp_dir and os.path.isdir(tmp_dir):
                import shutil
                shutil.rmtree(tmp_dir, ignore_errors=True)
