"""
Constants for the LLM service.

This module contains constants used across the LLM service,
including Docling picture classification classes.
"""

# =============================================================================
# DOCLING PICTURE CLASSIFICATION CLASSES
# =============================================================================
# 
# These are the 26 picture classification classes supported by Docling's
# DocumentFigureClassifier (from docling-ibm-models).
#
# Source: docling_ibm_models.document_figure_classifier_model
# Version: As of docling 2.x (January 2026)
#
# The classifier outputs predictions with class_name and confidence for each class.
# The top prediction (highest confidence) is typically used as the classification.

DOCLING_PICTURE_CLASSES = [
    "bar_chart",                # Bar/column chart visualization
    "bar_code",                 # 1D barcode (UPC, EAN, etc.)
    "box_plot",                 # Box-and-whisker plot
    "calendar",                 # Calendar visualization
    "chemistry_structure",      # Molecular/chemical structure diagram
    "crossword_puzzle",         # Crossword puzzle grid
    "engineering_drawing",      # Technical/engineering diagram
    "flow_chart",               # Process flow diagram
    "full_page_image",          # Image spanning the full page
    "geographical_map",         # Geographic/political map
    "icon",                     # Small symbolic icon
    "line_chart",               # Line graph/chart
    "logo",                     # Company/brand logo
    "music",                    # Musical notation/score
    "other",                    # Unclassified/general image
    "page_thumbnail",           # Thumbnail of another page
    "photograph",               # Real-world photograph
    "pie_chart",                # Pie/donut chart
    "qr_code",                  # QR code
    "scatter_plot",             # Scatter/dot plot
    "screenshot_from_computer", # Screenshot of software/desktop
    "screenshot_from_manual",   # Screenshot from documentation/manual
    "signature",                # Handwritten signature
    "stamp",                    # Official stamp/seal
    "table",                    # Table rendered as image
    "topographical_map",        # Topographic/terrain map
]

# Set for O(1) lookup
DOCLING_PICTURE_CLASSES_SET = frozenset(DOCLING_PICTURE_CLASSES)

# Categories for grouping (useful for UI organization or batch operations)
DOCLING_PICTURE_CATEGORIES = {
    "charts": [
        "bar_chart",
        "line_chart", 
        "pie_chart",
        "scatter_plot",
        "box_plot",
    ],
    "diagrams": [
        "flow_chart",
        "engineering_drawing",
        "chemistry_structure",
    ],
    "maps": [
        "geographical_map",
        "topographical_map",
    ],
    "codes": [
        "bar_code",
        "qr_code",
    ],
    "screenshots": [
        "screenshot_from_computer",
        "screenshot_from_manual",
    ],
    "decorative": [
        "logo",
        "icon",
        "stamp",
        "signature",
    ],
    "photos": [
        "photograph",
        "full_page_image",
        "page_thumbnail",
    ],
    "other": [
        "calendar",
        "crossword_puzzle",
        "music",
        "table",
        "other",
    ],
}

# Classes typically considered "noise" that users may want to auto-remove
DOCLING_DECORATIVE_CLASSES = frozenset([
    "logo",
    "icon", 
    "stamp",
    "signature",
    "bar_code",
    "qr_code",
])

# Classes that typically contain meaningful content for RAG
DOCLING_CONTENT_CLASSES = frozenset([
    "bar_chart",
    "line_chart",
    "pie_chart",
    "scatter_plot",
    "box_plot",
    "flow_chart",
    "engineering_drawing",
    "chemistry_structure",
    "geographical_map",
    "topographical_map",
    "screenshot_from_computer",
    "screenshot_from_manual",
    "photograph",
    "table",
])


def is_valid_picture_class(class_name: str) -> bool:
    """Check if a class name is a valid Docling picture classification."""
    return class_name in DOCLING_PICTURE_CLASSES_SET


def get_picture_category(class_name: str) -> str | None:
    """Get the category for a picture classification class."""
    for category, classes in DOCLING_PICTURE_CATEGORIES.items():
        if class_name in classes:
            return category
    return None


def is_decorative_class(class_name: str) -> bool:
    """Check if a picture class is typically decorative (noise)."""
    return class_name in DOCLING_DECORATIVE_CLASSES


def is_content_class(class_name: str) -> bool:
    """Check if a picture class typically contains meaningful content."""
    return class_name in DOCLING_CONTENT_CLASSES
