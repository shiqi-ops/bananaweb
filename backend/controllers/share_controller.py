import base64
import io
import logging
import os
import uuid
import qrcode
from flask import Blueprint, request,jsonify
from models import InviteRecord, db, Reward
from PIL import Image, ImageDraw, ImageFont
share_bp = Blueprint('share_bp', __name__,url_prefix='/api/share')
logger=logging.getLogger(__name__)
@share_bp.route('/invite-link',methods=['GET'])
def invite_link():
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'code': 400, 'message': 'user_id不可以为空'})
        existing = InviteRecord.query.filter_by(inviter_user_id=user_id).first()
        if existing:
            invite_code = existing.invite_code
        else:
            invite_code = uuid.uuid4().hex[:8]
            record = InviteRecord(
                inviter_user_id=user_id,
                invite_code=invite_code,
                status='PENDING'
            )
            db.session.add(record)
            db.session.commit()
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        invite_link = f"{frontend_url}/register?invite_code={invite_code}"
        return jsonify({'code': 200, 'message': 'success', 'data': {
            'invite_code': invite_code,
            'invite_link': invite_link
        }})
    except Exception as e:
        logger.error(e)
        return jsonify({'code':400,'message':f'{e}'})
@share_bp.route('/qrcode',methods=['GET'])
def generate_qrcode():
    user_id=request.args.get('user_id')
    if not user_id:
        return jsonify({'code': 400, 'message': 'user_id不能为空'})
    existing = InviteRecord.query.filter_by(inviter_user_id=user_id).first()
    if existing:
        invite_code = existing.invite_code
    else:
        invite_code = uuid.uuid4().hex[:8]
        record = InviteRecord(
            inviter_user_id=user_id,
            invite_code=invite_code,
            status='PENDING'
        )
        db.session.add(record)
        db.session.commit()
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    invite_link = f"{frontend_url}/register?invite_code={invite_code}"

    img = qrcode.make(invite_link)
    buf=io.BytesIO()
    img.save(buf,format='png')
    buf.seek(0)
    return jsonify({'code': 200, 'message': 'success', 'data': {
        'qrcode_base64': base64.b64encode(buf.read()).decode('utf-8')
    }})
@share_bp.route('/poster',methods=['POST'])
def poster():
    data = request.get_json()
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'code': 400, 'message': 'user_id不能为空'})
    invite_link=_get_or_create_invite_link(user_id)
    poster_img = _build_poster(invite_link)

    buf = io.BytesIO()
    poster_img.save(buf,format='png')
    buf.seek(0)
    return jsonify({'code': 200, 'message': 'success', 'data': {
        'poster_base64': base64.b64encode(buf.read()).decode('utf-8')
    }})
@share_bp.route('/invitees',methods=['GET'])
def invitees():
    user_id=request.args.get('user_id')
    if not user_id:
        return jsonify({'code': 400, 'message': 'user_id不能为空'})
    invitees = InviteRecord.get_by_inviter(user_id)
    result=[i.to_dict() for i in invitees]
    return jsonify({'code': 200, 'data': result,'message': 'success'})
@share_bp.route('/rewards',methods=['GET'])
def rewards():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'code': 400, 'message': 'user_id不能为空'})
    rewards = Reward.get_by_user_id(user_id)
    if not rewards:
        return jsonify({'code': 200, 'message': "没有查到"})
    result = [r.to_dict() for r in rewards]
    return jsonify({'code': 200, 'message': 'success', 'data': result})
@share_bp.route('rewards/<string:id>/claim',methods=['POST'])
def claim(id):
    data = request.get_json()
    user_id = data.get('user_id')

    reward = Reward.query.get(id)
    if not reward:
        return jsonify({'code': 400, 'message': '奖励不存在'})
    if reward.user_id != user_id:
        return jsonify({'code': 403, 'message': '无权领取'})
    if reward.is_claimed:
        return jsonify({'code': 200, 'message': '已领取，无需重复领取'})
    reward.is_claimed = True
    db.session.commit()

    return jsonify({'code': 200,'message':'已领取'})
def _get_or_create_invite_link(user_id):
    existing = InviteRecord.query.filter_by(inviter_user_id=user_id).first()
    if existing:
        invite_code = existing.invite_code
    else:
        invite_code = uuid.uuid4().hex[:8]
        record = InviteRecord(
            inviter_user_id=user_id,
            invite_code=invite_code,
            status='PENDING'
        )
        db.session.add(record)
        db.session.commit()
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    invite_link = f"{frontend_url}/register?invite_code={invite_code}"
    return invite_link


# ============================================================
# 海报绘制
# ============================================================

_POSTER_WIDTH = 750
_POSTER_HEIGHT = 1334

# 品牌色
_BRAND_TOP = (255, 228, 77)      # #FFE44D
_BRAND_BOTTOM = (245, 166, 35)   # #F5A623
_TEXT_DARK = (92, 58, 0)         # #5C3A00 深棕，保证黄底上可读
_TEXT_MUTED = (122, 77, 0)       # #7A4D00

_FONT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', 'fonts', 'NotoSansSC-Regular.ttf'
)


def _font(size):
    return ImageFont.truetype(_FONT_PATH, size)


def _vertical_gradient(width, height, top, bottom):
    """逐行插值生成垂直渐变底图。"""
    base = Image.new('RGB', (1, height))
    for y in range(height):
        t = y / (height - 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        base.putpixel((0, y), color)
    return base.resize((width, height))


_POSTER_BACKGROUND_PROMPT = (
    "Vertical 9:16 promotional poster background for an AI-powered presentation/slides "
    "generator app. Warm banana-yellow and soft orange gradient background, modern flat "
    "vector illustration style, with subtle decorative elements — a cute banana, "
    "presentation slides, sparkles and geometric shapes — placed around the edges. Keep the "
    "top-center, center and bottom-center areas large and completely clean/empty for "
    "overlaying text and a QR code. Minimalist, cheerful, high quality, no text, no letters, "
    "no numbers, no watermark, no QR code, no logo."
)


def _build_poster(invite_link):
    """生成邀请推广海报（750×1334 竖版）：优先 AI 底图，失败回退代码渐变底图。"""
    try:
        bg = _generate_poster_background()
        logger.info("使用 AI 生成的海报底图")
    except Exception as e:
        logger.warning("AI 生成海报底图失败，回退到代码渐变底图: %s", e)
        bg = _build_fallback_background()
    return _compose_poster(bg, invite_link)


def _generate_poster_background():
    """调用 AI 生成竖版海报底图，并裁到 750×1334。"""
    from services.ai_service import AIService

    image = AIService().generate_image(
        prompt=_POSTER_BACKGROUND_PROMPT,
        aspect_ratio="9:16",
        resolution="2K",
    )
    if image is None:
        raise RuntimeError("AI 未返回图片")
    return _fit_to_poster(image)


def _fit_to_poster(image):
    """等比缩放覆盖到目标尺寸，再居中裁剪。"""
    target = (_POSTER_WIDTH, _POSTER_HEIGHT)
    ratio = max(target[0] / image.width, target[1] / image.height)
    new_size = (int(image.width * ratio), int(image.height * ratio))
    image = image.convert('RGB').resize(new_size, Image.Resampling.LANCZOS)
    left = (image.width - target[0]) // 2
    top = (image.height - target[1]) // 2
    return image.crop((left, top, left + target[0], top + target[1]))


def _build_fallback_background():
    """代码绘制的香蕉黄渐变底图 + 装饰圆。"""
    base = _vertical_gradient(_POSTER_WIDTH, _POSTER_HEIGHT, _BRAND_TOP, _BRAND_BOTTOM)
    overlay = Image.new('RGBA', (_POSTER_WIDTH, _POSTER_HEIGHT), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    odraw.ellipse((-90, -90, 190, 190), fill=(255, 255, 255, 28))
    odraw.ellipse((560, 180, 840, 460), fill=(255, 255, 255, 20))
    odraw.ellipse((620, 640, 830, 850), fill=(255, 255, 255, 22))
    return Image.alpha_composite(base.convert('RGBA'), overlay).convert('RGB')


def _compose_poster(bg, invite_link):
    """在底图上叠加文字与二维码（半透明卡片保证任意底图上可读）。"""
    base = bg.convert('RGB')
    overlay = Image.new('RGBA', (_POSTER_WIDTH, _POSTER_HEIGHT), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)

    # 顶部品牌横幅（半透明白）
    odraw.rounded_rectangle((60, 70, 690, 250), radius=28, fill=(255, 255, 255, 200))
    # 中部亮点卡片
    odraw.rounded_rectangle((60, 330, 690, 720), radius=32, fill=(255, 255, 255, 220))
    # 底部二维码卡（不透明白，保证扫码）
    odraw.rounded_rectangle((165, 890, 585, 1290), radius=28, fill=(255, 255, 255, 255))

    base = Image.alpha_composite(base.convert('RGBA'), overlay).convert('RGB')
    draw = ImageDraw.Draw(base)

    # 顶部品牌文字
    draw.text((_POSTER_WIDTH // 2, 135), '智绘视界', font=_font(64), fill=_TEXT_DARK, anchor='mm')
    draw.text((_POSTER_WIDTH // 2, 207), 'AI 一键生成精美 PPT', font=_font(30), fill=_TEXT_MUTED, anchor='mm')

    # 中部产品亮点
    highlights = ['一句话生成 PPT', '一键导出 PPTX / PDF', 'AI 智能诊断优化']
    for i, line in enumerate(highlights):
        cy = 410 + i * 90
        draw.ellipse((130, cy - 9, 148, cy + 9), fill=_BRAND_BOTTOM)
        draw.text((170, cy), line, font=_font(32), fill=_TEXT_DARK, anchor='lm')

    # 邀请奖励提示（深棕胶囊）
    reward_text = '邀请好友注册，双方都能获得奖励'
    reward_w = draw.textlength(reward_text, font=_font(30)) + 60
    rx0 = (_POSTER_WIDTH - reward_w) / 2
    draw.rounded_rectangle((rx0, 780, rx0 + reward_w, 850), radius=35, fill=_TEXT_DARK)
    draw.text((_POSTER_WIDTH // 2, 815), reward_text, font=_font(30), fill=(255, 255, 255), anchor='mm')

    # 底部二维码
    qr_img = qrcode.make(invite_link).convert('RGB').resize((300, 300), Image.Resampling.LANCZOS)
    base.paste(qr_img, (225, 920))
    draw.text((_POSTER_WIDTH // 2, 1255), '长按识别二维码，立即注册', font=_font(28), fill=_TEXT_MUTED, anchor='ma')

    return base