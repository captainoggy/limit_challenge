import django_filters
from django.db.models import Q

from submissions import models


class SubmissionFilterSet(django_filters.FilterSet):
    """Filter set for the submissions list endpoint.

    Query params are camelCase to match the frontend + camel-case renderer:
      - status:         exact match on Submission.status
      - brokerId:       exact match on Submission.broker
      - companySearch:  case-insensitive contains on Company.legal_name, industry, or city
      - createdFrom:    inclusive lower bound on created_at
      - createdTo:      inclusive upper bound on created_at
      - hasDocuments:   boolean; true => only submissions with >=1 document
      - hasNotes:       boolean; true => only submissions with >=1 note
    """

    status = django_filters.ChoiceFilter(
        field_name="status",
        choices=models.Submission.Status.choices,
    )
    brokerId = django_filters.NumberFilter(field_name="broker_id")
    companySearch = django_filters.CharFilter(method="filter_company_search")
    createdFrom = django_filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="gte")
    createdTo = django_filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="lte")
    hasDocuments = django_filters.BooleanFilter(method="filter_has_documents")
    hasNotes = django_filters.BooleanFilter(method="filter_has_notes")

    class Meta:
        model = models.Submission
        fields = [
            "status",
            "brokerId",
            "companySearch",
            "createdFrom",
            "createdTo",
            "hasDocuments",
            "hasNotes",
        ]

    def filter_company_search(self, queryset, name, value):
        term = (value or "").strip()
        if not term:
            return queryset
        return queryset.filter(
            Q(company__legal_name__icontains=term)
            | Q(company__industry__icontains=term)
            | Q(company__headquarters_city__icontains=term)
        )

    def filter_has_documents(self, queryset, name, value):
        if value:
            return queryset.filter(documents__isnull=False).distinct()
        return queryset.filter(documents__isnull=True)

    def filter_has_notes(self, queryset, name, value):
        if value:
            return queryset.filter(notes__isnull=False).distinct()
        return queryset.filter(notes__isnull=True)
