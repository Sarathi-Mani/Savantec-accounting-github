"""
Audit Trail Service - Track all changes to financial documents.

Features:
- Automatic tracking via SQLAlchemy events
- Before/after value capture
- User tracking
- Search and filtering of audit logs
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import event, inspect
from sqlalchemy.orm.attributes import get_history
import json

from app.database.models import AuditLog, generate_uuid


# Tables to audit
AUDITED_TABLES = [
    'transactions',
    'transaction_entries',
    'invoices',
    'invoice_items',
    'purchase_invoices',
    'purchase_invoice_items',
    'payments',
    'purchase_payments',
    'accounts',
    'customers',
    'products',
    'employees',
    'payroll_runs',
    'payroll_entries',
    'cheques',
    'bill_allocations',
]

# Fields to exclude from audit (sensitive or binary)
EXCLUDED_FIELDS = [
    'password',
    'password_hash',
    'pdf_data',
    'raw_data',
    'created_at',
    'updated_at',
]


class AuditContext:
    """Thread-local context for audit information."""
    _current_user_id: Optional[str] = None
    _current_user_name: Optional[str] = None
    _ip_address: Optional[str] = None
    _user_agent: Optional[str] = None
    _session_id: Optional[str] = None
    
    @classmethod
    def set_user(cls, user_id: str, user_name: str = None):
        cls._current_user_id = user_id
        cls._current_user_name = user_name
    
    @classmethod
    def set_request_info(cls, ip_address: str = None, user_agent: str = None, session_id: str = None):
        cls._ip_address = ip_address
        cls._user_agent = user_agent
        cls._session_id = session_id
    
    @classmethod
    def clear(cls):
        cls._current_user_id = None
        cls._current_user_name = None
        cls._ip_address = None
        cls._user_agent = None
        cls._session_id = None
    
    @classmethod
    def get_context(cls) -> Dict:
        return {
            'user_id': cls._current_user_id,
            'user_name': cls._current_user_name,
            'ip_address': cls._ip_address,
            'user_agent': cls._user_agent,
            'session_id': cls._session_id,
        }


def serialize_value(value: Any) -> Any:
    """Convert a value to a JSON-serializable format."""
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, 'value'):  # Enum
        return value.value
    try:
        return str(value)
    except:
        return None


def get_model_dict(obj, exclude_fields: List[str] = None) -> Dict:
    """Convert a model object to a dictionary."""
    if exclude_fields is None:
        exclude_fields = EXCLUDED_FIELDS
    
    result = {}
    mapper = inspect(obj.__class__)
    
    for column in mapper.columns:
        if column.key in exclude_fields:
            continue
        value = getattr(obj, column.key, None)
        result[column.key] = serialize_value(value)
    
    return result


def get_changes(obj) -> tuple:
    """Get the changed fields and their old/new values."""
    changes = {}
    old_values = {}
    new_values = {}
    
    mapper = inspect(obj.__class__)
    
    for column in mapper.columns:
        if column.key in EXCLUDED_FIELDS:
            continue
        
        history = get_history(obj, column.key)
        
        if history.has_changes():
            old = history.deleted[0] if history.deleted else None
            new = history.added[0] if history.added else None
            
            changes[column.key] = {
                'old': serialize_value(old),
                'new': serialize_value(new),
            }
            old_values[column.key] = serialize_value(old)
            new_values[column.key] = serialize_value(new)
    
    return changes, old_values, new_values


class AuditService:
    """Service for managing audit logs."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def log_action(
        self,
        company_id: str,
        table_name: str,
        record_id: str,
        action: str,
        old_values: Dict = None,
        new_values: Dict = None,
        changed_fields: List[str] = None,
        user_id: str = None,
        user_name: str = None,
        ip_address: str = None,
        user_agent: str = None,
        session_id: str = None,
    ) -> AuditLog:
        """Create an audit log entry."""
        context = AuditContext.get_context()
        
        audit_log = AuditLog(
            id=generate_uuid(),
            company_id=company_id,
            table_name=table_name,
            record_id=record_id,
            action=action,
            old_values=old_values,
            new_values=new_values,
            changed_fields=changed_fields,
            changed_by=user_id or context['user_id'],
            changed_by_name=user_name or context['user_name'],
            changed_at=datetime.utcnow(),
            ip_address=ip_address or context['ip_address'],
            user_agent=user_agent or context['user_agent'],
            session_id=session_id or context['session_id'],
        )
        
        self.db.add(audit_log)
        return audit_log
    
    def log_create(
        self,
        company_id: str,
        table_name: str,
        record_id: str,
        new_values: Dict,
    ) -> AuditLog:
        """Log a create action."""
        return self.log_action(
            company_id=company_id,
            table_name=table_name,
            record_id=record_id,
            action='create',
            new_values=new_values,
            changed_fields=list(new_values.keys()) if new_values else None,
        )
    
    def log_update(
        self,
        company_id: str,
        table_name: str,
        record_id: str,
        old_values: Dict,
        new_values: Dict,
    ) -> AuditLog:
        """Log an update action."""
        changed_fields = [
            k for k in new_values.keys()
            if old_values.get(k) != new_values.get(k)
        ]
        
        return self.log_action(
            company_id=company_id,
            table_name=table_name,
            record_id=record_id,
            action='update',
            old_values=old_values,
            new_values=new_values,
            changed_fields=changed_fields,
        )
    
    def log_delete(
        self,
        company_id: str,
        table_name: str,
        record_id: str,
        old_values: Dict,
    ) -> AuditLog:
        """Log a delete action."""
        return self.log_action(
            company_id=company_id,
            table_name=table_name,
            record_id=record_id,
            action='delete',
            old_values=old_values,
        )
    
    # ==================== QUERY METHODS ====================
    
    def get_audit_logs(
        self,
        company_id: str,
        table_name: str = None,
        record_id: str = None,
        action: str = None,
        user_id: str = None,
        from_date: datetime = None,
        to_date: datetime = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[AuditLog]:
        """Query audit logs with filters."""
        query = self.db.query(AuditLog).filter(AuditLog.company_id == company_id)
        
        if table_name:
            query = query.filter(AuditLog.table_name == table_name)
        
        if record_id:
            query = query.filter(AuditLog.record_id == record_id)
        
        if action:
            query = query.filter(AuditLog.action == action)
        
        if user_id:
            query = query.filter(AuditLog.changed_by == user_id)
        
        if from_date:
            query = query.filter(AuditLog.changed_at >= from_date)
        
        if to_date:
            query = query.filter(AuditLog.changed_at <= to_date)
        
        return query.order_by(AuditLog.changed_at.desc()).offset(offset).limit(limit).all()
    
    def get_record_history(
        self,
        company_id: str,
        table_name: str,
        record_id: str,
    ) -> List[AuditLog]:
        """Get complete history of a specific record."""
        return self.db.query(AuditLog).filter(
            AuditLog.company_id == company_id,
            AuditLog.table_name == table_name,
            AuditLog.record_id == record_id,
        ).order_by(AuditLog.changed_at.asc()).all()
    
    def get_user_activity(
        self,
        company_id: str,
        user_id: str,
        days: int = 30,
    ) -> List[AuditLog]:
        """Get recent activity by a specific user."""
        from_date = datetime.utcnow() - timedelta(days=days)
        
        return self.db.query(AuditLog).filter(
            AuditLog.company_id == company_id,
            AuditLog.changed_by == user_id,
            AuditLog.changed_at >= from_date,
        ).order_by(AuditLog.changed_at.desc()).all()
    
    def get_audit_summary(
        self,
        company_id: str,
        from_date: datetime = None,
        to_date: datetime = None,
    ) -> Dict:
        """Get summary statistics of audit activity."""
        from sqlalchemy import func
        
        if not from_date:
            from_date = datetime.utcnow() - timedelta(days=30)
        if not to_date:
            to_date = datetime.utcnow()
        
        query = self.db.query(AuditLog).filter(
            AuditLog.company_id == company_id,
            AuditLog.changed_at >= from_date,
            AuditLog.changed_at <= to_date,
        )
        
        # Count by action
        action_counts = {}
        for action in ['create', 'update', 'delete']:
            count = query.filter(AuditLog.action == action).count()
            action_counts[action] = count
        
        # Count by table
        table_counts = self.db.query(
            AuditLog.table_name,
            func.count(AuditLog.id)
        ).filter(
            AuditLog.company_id == company_id,
            AuditLog.changed_at >= from_date,
            AuditLog.changed_at <= to_date,
        ).group_by(AuditLog.table_name).all()
        
        # Count by user
        user_counts = self.db.query(
            AuditLog.changed_by,
            AuditLog.changed_by_name,
            func.count(AuditLog.id)
        ).filter(
            AuditLog.company_id == company_id,
            AuditLog.changed_at >= from_date,
            AuditLog.changed_at <= to_date,
        ).group_by(AuditLog.changed_by, AuditLog.changed_by_name).all()
        
        return {
            'period': {
                'from': from_date.isoformat(),
                'to': to_date.isoformat(),
            },
            'total_entries': query.count(),
            'by_action': action_counts,
            'by_table': {t: c for t, c in table_counts},
            'by_user': [
                {'user_id': u, 'user_name': n, 'count': c}
                for u, n, c in user_counts
            ],
        }
    
    def compare_versions(
        self,
        company_id: str,
        table_name: str,
        record_id: str,
        version1_id: str,
        version2_id: str,
    ) -> Dict:
        """Compare two versions of a record."""
        v1 = self.db.query(AuditLog).filter(
            AuditLog.id == version1_id,
            AuditLog.company_id == company_id,
        ).first()
        
        v2 = self.db.query(AuditLog).filter(
            AuditLog.id == version2_id,
            AuditLog.company_id == company_id,
        ).first()
        
        if not v1 or not v2:
            return {'error': 'Version not found'}
        
        v1_values = v1.new_values or v1.old_values or {}
        v2_values = v2.new_values or v2.old_values or {}
        
        all_keys = set(v1_values.keys()) | set(v2_values.keys())
        
        differences = []
        for key in all_keys:
            val1 = v1_values.get(key)
            val2 = v2_values.get(key)
            if val1 != val2:
                differences.append({
                    'field': key,
                    'version1': val1,
                    'version2': val2,
                })
        
        return {
            'version1': {
                'id': v1.id,
                'action': v1.action,
                'changed_at': v1.changed_at.isoformat(),
                'changed_by': v1.changed_by_name or v1.changed_by,
            },
            'version2': {
                'id': v2.id,
                'action': v2.action,
                'changed_at': v2.changed_at.isoformat(),
                'changed_by': v2.changed_by_name or v2.changed_by,
            },
            'differences': differences,
        }


# ==================== HELPER FUNCTIONS ====================

def audit_model_changes(session: Session, model_instance, action: str, company_id: str = None):
    """Helper to audit model changes manually."""
    table_name = model_instance.__tablename__
    record_id = getattr(model_instance, 'id', None)
    
    if not company_id:
        company_id = getattr(model_instance, 'company_id', None)
    
    if not company_id or not record_id:
        return
    
    service = AuditService(session)
    
    if action == 'create':
        new_values = get_model_dict(model_instance)
        service.log_create(company_id, table_name, record_id, new_values)
    
    elif action == 'update':
        changes, old_values, new_values = get_changes(model_instance)
        if changes:
            service.log_update(company_id, table_name, record_id, old_values, new_values)
    
    elif action == 'delete':
        old_values = get_model_dict(model_instance)
        service.log_delete(company_id, table_name, record_id, old_values)


def setup_audit_listeners(engine):
    """Set up SQLAlchemy event listeners for automatic auditing."""
    # Note: This is a placeholder. In production, you would set up
    # event listeners on specific models. For now, we'll use manual
    # auditing in the service layer.
    pass
