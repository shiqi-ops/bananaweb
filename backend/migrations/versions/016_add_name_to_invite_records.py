"""add name to invite_records

Revision ID: 016_add_name_to_invite_records
Revises: b09f491a1d0e
Create Date: 2026-08-17 20:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '016_add_name_to_invite_records'
down_revision = 'b09f491a1d0e'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if column exists"""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    """为 invite_records 补上 name 列（被邀请人名称），幂等。"""
    if not _column_exists('invite_records', 'name'):
        op.add_column('invite_records', sa.Column('name', sa.String(length=100), nullable=True))


def downgrade() -> None:
    if _column_exists('invite_records', 'name'):
        op.drop_column('invite_records', 'name')
