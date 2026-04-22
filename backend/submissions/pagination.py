from rest_framework.pagination import PageNumberPagination


class SubmissionPagination(PageNumberPagination):
    """Page-number pagination with a client-configurable page size.

    The `pageSize` query param lets the UI offer a rows-per-page picker
    (10 / 20 / 50 / 100). `max_page_size` caps the value so a client can't
    request an unbounded payload.
    """

    page_size = 10
    page_size_query_param = "pageSize"
    max_page_size = 100
