"""
Cost Center Service - Manage cost centers and cost categories.

Cost centers allow tracking expenses by department, project, or location.
Cost categories group expenses by type (direct, indirect, administrative).
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    CostCenter, CostCategory, CostCenterAllocationType,
    TransactionEntry, Transaction, Account
)


class CostCenterService:
    """Service for managing cost centers and categories."""
    
    def __init__(self, db: Session):
        self.db = db
    
    # ==================== COST CENTER MANAGEMENT ====================
    
    def create_cost_center(
        self,
        company_id: str,
        code: str,
        name: str,
        description: str = "",
        parent_id: Optional[str] = None,
        department_id: Optional[str] = None,
    ) -> CostCenter:
        """Create a new cost center."""
        # Check for duplicate code
        existing = self.db.query(CostCenter).filter(
            CostCenter.company_id == company_id,
            CostCenter.code == code,
        ).first()
        
        if existing:
            raise ValueError(f"Cost center with code {code} already exists")
        
        # Calculate level based on parent
        level = 0
        if parent_id:
            parent = self.db.query(CostCenter).filter(CostCenter.id == parent_id).first()
            if parent:
                level = parent.level + 1
        
        cost_center = CostCenter(
            company_id=company_id,
            code=code,
            name=name,
            description=description,
            parent_id=parent_id,
            level=level,
            department_id=department_id,
            is_active=True,
        )
        
        self.db.add(cost_center)
        self.db.commit()
        self.db.refresh(cost_center)
        
        return cost_center
    
    def get_cost_center(self, cost_center_id: str) -> Optional[CostCenter]:
        """Get cost center by ID."""
        return self.db.query(CostCenter).filter(CostCenter.id == cost_center_id).first()
    
    def get_cost_center_by_code(self, company_id: str, code: str) -> Optional[CostCenter]:
        """Get cost center by code."""
        return self.db.query(CostCenter).filter(
            CostCenter.company_id == company_id,
            CostCenter.code == code,
        ).first()
    
    def list_cost_centers(
        self,
        company_id: str,
        active_only: bool = True,
        parent_id: Optional[str] = None,
    ) -> List[CostCenter]:
        """List cost centers for a company."""
        query = self.db.query(CostCenter).filter(CostCenter.company_id == company_id)
        
        if active_only:
            query = query.filter(CostCenter.is_active == True)
        
        if parent_id is not None:
            query = query.filter(CostCenter.parent_id == parent_id)
        
        return query.order_by(CostCenter.code).all()
    
    def get_cost_center_hierarchy(self, company_id: str) -> List[Dict]:
        """Get cost centers in hierarchical structure."""
        all_centers = self.list_cost_centers(company_id, active_only=True)
        
        # Build tree structure
        centers_by_id = {c.id: c for c in all_centers}
        root_centers = []
        
        for center in all_centers:
            center_dict = {
                "id": center.id,
                "code": center.code,
                "name": center.name,
                "description": center.description,
                "level": center.level,
                "children": [],
            }
            
            if center.parent_id is None:
                root_centers.append(center_dict)
            else:
                # Find parent and add as child
                for root in root_centers:
                    self._add_to_parent(root, center.parent_id, center_dict)
        
        return root_centers
    
    def _add_to_parent(self, node: Dict, parent_id: str, child: Dict):
        """Recursively add child to parent in hierarchy."""
        if node["id"] == parent_id:
            node["children"].append(child)
            return True
        
        for sub_node in node["children"]:
            if self._add_to_parent(sub_node, parent_id, child):
                return True
        
        return False
    
    def update_cost_center(
        self,
        cost_center_id: str,
        **kwargs,
    ) -> CostCenter:
        """Update cost center."""
        cost_center = self.get_cost_center(cost_center_id)
        if not cost_center:
            raise ValueError("Cost center not found")
        
        for key, value in kwargs.items():
            if hasattr(cost_center, key) and value is not None:
                setattr(cost_center, key, value)
        
        self.db.commit()
        self.db.refresh(cost_center)
        
        return cost_center
    
    def deactivate_cost_center(self, cost_center_id: str) -> CostCenter:
        """Deactivate a cost center."""
        return self.update_cost_center(cost_center_id, is_active=False)
    
    # ==================== COST CATEGORY MANAGEMENT ====================
    
    def create_cost_category(
        self,
        company_id: str,
        code: str,
        name: str,
        description: str = "",
        allocation_type: CostCenterAllocationType = CostCenterAllocationType.AMOUNT,
    ) -> CostCategory:
        """Create a new cost category."""
        existing = self.db.query(CostCategory).filter(
            CostCategory.company_id == company_id,
            CostCategory.code == code,
        ).first()
        
        if existing:
            raise ValueError(f"Cost category with code {code} already exists")
        
        category = CostCategory(
            company_id=company_id,
            code=code,
            name=name,
            description=description,
            allocation_type=allocation_type,
            is_active=True,
        )
        
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        
        return category
    
    def list_cost_categories(
        self,
        company_id: str,
        active_only: bool = True,
    ) -> List[CostCategory]:
        """List cost categories for a company."""
        query = self.db.query(CostCategory).filter(CostCategory.company_id == company_id)
        
        if active_only:
            query = query.filter(CostCategory.is_active == True)
        
        return query.order_by(CostCategory.code).all()
    
    def initialize_default_categories(self, company_id: str) -> List[CostCategory]:
        """Initialize default cost categories."""
        defaults = [
            {"code": "DIRECT", "name": "Direct Costs", "desc": "Direct production/project costs"},
            {"code": "INDIRECT", "name": "Indirect Costs", "desc": "Overhead and indirect costs"},
            {"code": "ADMIN", "name": "Administrative", "desc": "Administrative and general expenses"},
            {"code": "SELLING", "name": "Selling & Marketing", "desc": "Sales and marketing expenses"},
            {"code": "FINANCE", "name": "Finance Costs", "desc": "Interest and finance charges"},
        ]
        
        created = []
        for cat in defaults:
            existing = self.db.query(CostCategory).filter(
                CostCategory.company_id == company_id,
                CostCategory.code == cat["code"],
            ).first()
            
            if not existing:
                category = CostCategory(
                    company_id=company_id,
                    code=cat["code"],
                    name=cat["name"],
                    description=cat["desc"],
                    is_active=True,
                )
                self.db.add(category)
                created.append(category)
        
        self.db.commit()
        return created
    
    # ==================== COST CENTER REPORTING ====================
    
    def get_cost_center_summary(
        self,
        company_id: str,
        cost_center_id: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> Dict:
        """Get summary of expenses for a cost center."""
        # Note: This requires TransactionEntry to have cost_center_id field
        # For now, return placeholder structure
        return {
            "cost_center_id": cost_center_id,
            "total_expenses": 0,
            "total_revenue": 0,
            "net_position": 0,
            "by_account": [],
            "by_month": [],
        }
    
    def get_cost_center_comparison(
        self,
        company_id: str,
        from_date: datetime,
        to_date: datetime,
    ) -> List[Dict]:
        """Compare expenses across cost centers."""
        cost_centers = self.list_cost_centers(company_id)
        
        comparison = []
        for cc in cost_centers:
            summary = self.get_cost_center_summary(company_id, cc.id, from_date, to_date)
            comparison.append({
                "cost_center_id": cc.id,
                "code": cc.code,
                "name": cc.name,
                "total_expenses": summary["total_expenses"],
                "percentage_of_total": 0,  # Calculate after getting all totals
            })
        
        # Calculate percentages
        total = sum(c["total_expenses"] for c in comparison)
        if total > 0:
            for c in comparison:
                c["percentage_of_total"] = round(c["total_expenses"] / total * 100, 2)
        
        return comparison
