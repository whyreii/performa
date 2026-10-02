"""Machine learning package for Performa.

Provides the fixed competency ordering and access to the training catalog.
"""

from .catalog import COMPETENCIES, get_catalog, recommend_courses

__all__ = ["COMPETENCIES", "get_catalog", "recommend_courses"]
