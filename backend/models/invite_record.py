import uuid
from uuid import uuid4

import utcnow
from sqlalchemy import Column, String, Boolean, DateTime

from models import db


class InviteRecord(db.Model):
    __tablename__ = 'invite_records'

    id              = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    inviter_user_id = Column(String(36), nullable=False)          # 邀请人
    invitee_user_id = Column(String(36), nullable=True)           # 被邀请人（注册后回填）
    invite_code     = Column(String(20), unique=True, nullable=False)  # 邀请码
    status          = Column(String(20), default='PENDING')       # PENDING / REGISTERED / REWARDED
    reward_granted  = Column(Boolean, default=False)              # 奖励是否已发放
    created_at      = Column(DateTime, default=utcnow)
    registered_at   = Column(DateTime, nullable=True)             # 被邀请人注册时间