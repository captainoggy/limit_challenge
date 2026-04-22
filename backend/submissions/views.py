from django.db.models import Count, OuterRef, Subquery
from rest_framework import viewsets

from submissions import models, serializers
from submissions.filters.submission import SubmissionFilterSet


class SubmissionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only endpoints for submissions.

    List queries are annotated with related counts and the latest note preview so the UI
    can render rich rows without a waterfall of requests. Detail queries eager-load related
    records to avoid N+1 queries when rendering contacts, documents, and notes.
    """

    filterset_class = SubmissionFilterSet

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
            ).order_by("-created_at", "-id")
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
