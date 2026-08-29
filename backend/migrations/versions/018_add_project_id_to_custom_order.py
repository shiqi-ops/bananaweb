"""add project_id to custom_order table

Revision ID: 018_add_project_id_to_custom_order
Revises: 017_add_description_to_user_templates
Create Date: 2026-08-22

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '018_add_project_id_to_custom_order'
down_revision = '017_add_description_to_user_templates'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add nullable project_id column linking an order to its generated PPT project."""
    op.add_column('custom_order', sa.Column('project_id', sa.String(length=36), nullable=True))


def downgrade() -> None:
    op.drop_column('custom_order', 'project_id')
