"""Tests for the Submissions API.

Focused on the custom logic:
  * filter behavior (every branch of SubmissionFilterSet, including compositions)
  * list/detail/broker response contracts

Django + DRF internals (pagination mechanics, camelCase rendering, etc.) are
trusted to work and are not re-tested here.
"""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.test import APIClient

from submissions import models


class SubmissionsApiTests(TestCase):
    """Shared fixtures for all submission endpoint tests."""

    @classmethod
    def setUpTestData(cls):
        cls.broker_a = models.Broker.objects.create(name="Alpha Brokers", primary_contact_email="a@alpha.com")
        cls.broker_b = models.Broker.objects.create(name="Beta Brokers", primary_contact_email="b@beta.com")

        cls.acme = models.Company.objects.create(
            legal_name="ACME Technologies",
            industry="IT",
            headquarters_city="San Francisco",
        )
        cls.beta_health = models.Company.objects.create(
            legal_name="Beta Health Partners",
            industry="Healthcare",
            headquarters_city="Boston",
        )
        cls.gamma_retail = models.Company.objects.create(
            legal_name="Gamma Retail",
            industry="Retail",
            headquarters_city="Chicago",
        )

        cls.owner = models.TeamMember.objects.create(full_name="Jane Doe", email="jane@example.com")

        now = timezone.now()

        # s1: ACME, Broker A, new, created 30 days ago — has docs + notes
        cls.s1 = cls._make_submission(cls.acme, cls.broker_a, "new", "high")
        cls._backdate(cls.s1, now - timedelta(days=30))
        models.Document.objects.create(submission=cls.s1, title="Pitch", doc_type="Summary")
        models.Note.objects.create(submission=cls.s1, author_name="Jane", body="Initial note.")

        # s2: Beta Health, Broker B, in_review, created 10 days ago — has docs, no notes
        cls.s2 = cls._make_submission(cls.beta_health, cls.broker_b, "in_review", "medium")
        cls._backdate(cls.s2, now - timedelta(days=10))
        models.Document.objects.create(submission=cls.s2, title="Contract", doc_type="Contract")

        # s3: Gamma Retail, Broker A, closed, created 5 days ago — no docs, has notes
        cls.s3 = cls._make_submission(cls.gamma_retail, cls.broker_a, "closed", "low")
        cls._backdate(cls.s3, now - timedelta(days=5))
        models.Note.objects.create(submission=cls.s3, author_name="Jane", body="Closed — signed.")

        # s4: ACME, Broker B, new, created 1 day ago — no docs, no notes
        cls.s4 = cls._make_submission(cls.acme, cls.broker_b, "new", "high")
        cls._backdate(cls.s4, now - timedelta(days=1))

    @classmethod
    def _make_submission(cls, company, broker, status_value, priority):
        return models.Submission.objects.create(
            company=company,
            broker=broker,
            owner=cls.owner,
            status=status_value,
            priority=priority,
            summary=f"{company.legal_name} summary.",
        )

    @staticmethod
    def _backdate(submission, when):
        # auto_now_add fields can't be set via save(), so we update them directly.
        models.Submission.objects.filter(pk=submission.pk).update(created_at=when)

    def setUp(self):
        self.client = APIClient()
        self.list_url = reverse("submission-list")

    def _ids(self, response):
        return {row["id"] for row in response.data["results"]}

    # ------------------------------------------------------------------ filters

    def test_status_filter_returns_only_matching_rows(self):
        response = self.client.get(self.list_url, {"status": "new"})
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        self.assertEqual(self._ids(response), {self.s1.id, self.s4.id})

    def test_status_filter_rejects_invalid_choice(self):
        response = self.client.get(self.list_url, {"status": "not_a_status"})
        self.assertEqual(response.status_code, http_status.HTTP_400_BAD_REQUEST)

    def test_broker_id_filter(self):
        response = self.client.get(self.list_url, {"brokerId": self.broker_a.id})
        self.assertEqual(self._ids(response), {self.s1.id, self.s3.id})

    def test_company_search_matches_legal_name(self):
        response = self.client.get(self.list_url, {"companySearch": "ACME"})
        self.assertEqual(self._ids(response), {self.s1.id, self.s4.id})

    def test_company_search_matches_industry_or_city(self):
        # "Healthcare" only exists as an industry -> exercises the OR branch.
        industry_match = self.client.get(self.list_url, {"companySearch": "healthcare"})
        self.assertEqual(self._ids(industry_match), {self.s2.id})

        # "Chicago" only exists as a city -> exercises the other OR branch.
        city_match = self.client.get(self.list_url, {"companySearch": "chicago"})
        self.assertEqual(self._ids(city_match), {self.s3.id})

    def test_company_search_is_case_insensitive(self):
        response = self.client.get(self.list_url, {"companySearch": "acme"})
        self.assertEqual(self._ids(response), {self.s1.id, self.s4.id})

    def test_created_from_and_to_are_inclusive(self):
        now = timezone.now()
        params = {
            "createdFrom": (now - timedelta(days=15)).isoformat(),
            "createdTo": now.isoformat(),
        }
        response = self.client.get(self.list_url, params)
        # s2 (10d), s3 (5d), s4 (1d) fall inside; s1 (30d) does not.
        self.assertEqual(self._ids(response), {self.s2.id, self.s3.id, self.s4.id})

    def test_has_documents_true_excludes_rows_without_documents(self):
        response = self.client.get(self.list_url, {"hasDocuments": "true"})
        self.assertEqual(self._ids(response), {self.s1.id, self.s2.id})

    def test_has_notes_true_excludes_rows_without_notes(self):
        response = self.client.get(self.list_url, {"hasNotes": "true"})
        self.assertEqual(self._ids(response), {self.s1.id, self.s3.id})

    def test_filters_compose(self):
        # "new + broker B" should leave only s4.
        response = self.client.get(
            self.list_url,
            {"status": "new", "brokerId": self.broker_b.id},
        )
        self.assertEqual(self._ids(response), {self.s4.id})

    # ------------------------------------------------------------------ shapes

    def test_list_response_has_expected_shape(self):
        # Use .json() (the rendered bytes) so the camelCase contract is tested.
        response = self.client.get(self.list_url, {"status": "new"})
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        body = response.json()

        for key in ("count", "next", "previous", "results"):
            self.assertIn(key, body)

        row = next(r for r in body["results"] if r["id"] == self.s1.id)
        self.assertEqual(row["company"]["legalName"], "ACME Technologies")
        self.assertEqual(row["broker"]["name"], "Alpha Brokers")
        self.assertEqual(row["owner"]["fullName"], "Jane Doe")
        self.assertEqual(row["documentCount"], 1)
        self.assertEqual(row["noteCount"], 1)
        self.assertIsNotNone(row["latestNote"])
        self.assertEqual(row["latestNote"]["authorName"], "Jane")
        self.assertTrue(row["latestNote"]["bodyPreview"].startswith("Initial"))

    def test_detail_response_includes_related_collections(self):
        url = reverse("submission-detail", args=[self.s1.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["id"], self.s1.id)
        self.assertEqual(len(body["documents"]), 1)
        self.assertEqual(len(body["notes"]), 1)
        self.assertIn("contacts", body)

    def test_brokers_endpoint_returns_plain_array(self):
        # Contract: the frontend dropdown consumes this as Broker[], not paginated.
        response = self.client.get(reverse("broker-list"))
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        body = response.json()
        self.assertIsInstance(body, list)
        self.assertEqual(len(body), 2)

    # -------------------------------------------------------------- pagination

    def test_page_size_query_param_is_honored(self):
        response = self.client.get(self.list_url, {"pageSize": 2})
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(len(body["results"]), 2)
        self.assertEqual(body["count"], 4)
        self.assertIsNotNone(body["next"])

    def test_page_size_is_capped_at_max(self):
        # max_page_size is 100; requesting 999 should cap at 100, not error.
        response = self.client.get(self.list_url, {"pageSize": 999})
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        body = response.json()
        self.assertLessEqual(len(body["results"]), 100)
