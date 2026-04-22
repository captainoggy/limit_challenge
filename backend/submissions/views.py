from django.db.models import Case, Count, IntegerField, OuterRef, Subquery, Value, When
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets

from submissions import models, serializers
from submissions.filters.submission import SubmissionFilterSet

# Columns the client may sort by (mapped to DB expressions).
# "status" and "priority" are enums; lexicographic sort would be meaningless,
# so we expose them under the same name but back them with a Case/When so the
# order matches the real workflow / importance.
ORDERING_FIELDS = [
    "company__legal_name",
    "broker__name",
    "owner__full_name",
    "status",
    "priority",
    "document_count",
    "note_count",
    "created_at",
]

STATUS_ORDER = Case(
    When(status="new", then=Value(0)),
    When(status="in_review", then=Value(1)),
    When(status="closed", then=Value(2)),
    When(status="lost", then=Value(3)),
    output_field=IntegerField(),
)

PRIORITY_ORDER = Case(
    When(priority="high", then=Value(0)),
    When(priority="medium", then=Value(1)),
    When(priority="low", then=Value(2)),
    output_field=IntegerField(),
)


class SubmissionOrderingFilter(filters.OrderingFilter):
    """Ordering filter with two small niceties over DRF's default.

    1. `status` and `priority` are enums; lexicographic order is meaningless.
       We accept them at the API surface but map them to the semantic
       Case/When annotations (`status_rank`, `priority_rank`) underneath.
    2. We always append `-id` as a tiebreak so page boundaries stay stable
       when the primary sort key has ties (two rows with the same status,
       same created_at, etc.).
    """

    ENUM_MAP = {"status": "status_rank", "priority": "priority_rank"}

    def get_ordering(self, request, queryset, view):
        ordering = super().get_ordering(request, queryset, view) or []
        mapped = [self._map_term(term) for term in ordering]
        if "id" not in {t.lstrip("-") for t in mapped}:
            mapped.append("-id")
        return mapped

    def _map_term(self, term):
        prefix = "-" if term.startswith("-") else ""
        bare = term.lstrip("-")
        return f"{prefix}{self.ENUM_MAP.get(bare, bare)}"


class SubmissionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only endpoints for submissions.

    List queries are annotated with related counts and the latest note preview so the UI
    can render rich rows without a waterfall of requests. Detail queries eager-load related
    records to avoid N+1 queries when rendering contacts, documents, and notes.
    """

    filterset_class = SubmissionFilterSet
    filter_backends = [DjangoFilterBackend, SubmissionOrderingFilter]
    ordering_fields = ORDERING_FIELDS
    # Default sort + a stable tiebreak (id) so pagination never duplicates rows
    # when two submissions share a created_at down to the second.
    ordering = ["-created_at", "-id"]

    def get_queryset(self):
        queryset = models.Submission.objects.select_related("company", "broker", "owner")

        if self.action == "list":
            latest_note = models.Note.objects.filter(submission_id=OuterRef("pk")).order_by(
                "-created_at"
            )
            queryset = queryset.annotate(
                document_count=Count("documents", distinct=True),
                note_count=Count("notes", distinct=True),
                latest_note_author=Subquery(latest_note.values("author_name")[:1]),
                latest_note_body=Subquery(latest_note.values("body")[:1]),
                latest_note_created_at=Subquery(latest_note.values("created_at")[:1]),
                status_rank=STATUS_ORDER,
                priority_rank=PRIORITY_ORDER,
            )
        else:
            queryset = queryset.prefetch_related("contacts", "documents", "notes")

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return serializers.SubmissionListSerializer
        return serializers.SubmissionDetailSerializer


class BrokerViewSet(viewsets.ReadOnlyModelViewSet):
    """List brokers for the filter dropdown (unpaginated, ordered by name)."""

    queryset = models.Broker.objects.all()
    serializer_class = serializers.BrokerSerializer
    pagination_class = None
