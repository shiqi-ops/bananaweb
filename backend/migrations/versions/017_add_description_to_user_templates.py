"""add description to user_templates

Revision ID: 017_add_description_to_user_templates
Revises: 016_add_name_to_invite_records
Create Date: 2026-08-17 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '017_add_description_to_user_templates'
down_revision = '016_add_name_to_invite_records'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if column exists"""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    """为 user_templates 补上 description 列（风格描述），幂等。"""
    if not _column_exists('user_templates', 'description'):
        op.add_column('user_templates', sa.Column('description', sa.Text(), nullable=True))


def downgrade() -> None:
    if _column_exists('user_templates', 'description'):
        op.drop_column('user_templates', 'description')
