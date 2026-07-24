"""MetadataService — merges universal StoredFile fields + a registered
module extractor + tags. A live read, never a cache (design §2b)."""

from __future__ import annotations

import pytest
from metadata.registry import MetadataFields, MetadataProviderDef, register_metadata_provider
from metadata.services import MetadataService
from shared.exceptions import NotFoundError
from storage.services import StorageService
from tagging.services import TagService

pytestmark = pytest.mark.django_db

PDF = b"%PDF-1.4 fake but good enough"


def _store(tenant, **overrides):
    defaults = {
        "data": PDF,
        "filename": "bill.pdf",
        "content_type": "application/pdf",
        "module": "test.metadata.mod",
        "category": "invoice",
        "tenant": tenant,
    }
    defaults.update(overrides)
    return StorageService().store(**defaults)


@pytest.fixture(autouse=True)
def _register_test_provider():
    def extract(stored_file):
        return MetadataFields(
            title="Fake Bill",
            status="processed",
            business_object_type="FakeBill",
            business_object_id="fb-1",
            extra={"vendor": "Acme Supplies"},
        )

    register_metadata_provider(MetadataProviderDef(module="test.metadata.mod", extract=extract))


def test_universal_fields_always_present(tenant):
    stored = _store(tenant)
    metadata = MetadataService().get_metadata(stored_file=stored, tenant=tenant)

    assert metadata["storage_location"] == stored.key
    assert metadata["hash"] == stored.sha256
    assert metadata["document_type"] == "invoice"
    assert metadata["is_library"] is False


def test_module_fields_merge_in(tenant):
    stored = _store(tenant)
    metadata = MetadataService().get_metadata(stored_file=stored, tenant=tenant)

    assert metadata["title"] == "Fake Bill"
    assert metadata["status"] == "processed"
    assert metadata["extra"]["vendor"] == "Acme Supplies"


def test_tags_merge_in_via_existing_tag_service(tenant):
    stored = _store(tenant)
    TagService().set_tags_for_object(
        tenant=tenant,
        module="test.metadata.mod",
        object_type="FakeBill",
        object_id="fb-1",
        tag_names=["Auditor", "Urgent"],
    )
    metadata = MetadataService().get_metadata(stored_file=stored, tenant=tenant)

    assert set(metadata["tags"]) == {"Auditor", "Urgent"}


def test_unregistered_module_degrades_to_universal_only(tenant):
    stored = _store(tenant, module="no.provider.registered")
    metadata = MetadataService().get_metadata(stored_file=stored, tenant=tenant)

    assert metadata["storage_location"] == stored.key
    assert metadata["title"] == ""
    assert metadata["tags"] == []


def test_extractor_returning_none_degrades_to_universal_only(tenant):
    register_metadata_provider(
        MetadataProviderDef(module="test.metadata.orphan", extract=lambda stored_file: None)
    )
    stored = _store(tenant, module="test.metadata.orphan")
    metadata = MetadataService().get_metadata(stored_file=stored, tenant=tenant)

    assert metadata["title"] == ""
    assert metadata["tags"] == []


def test_cross_tenant_file_raises_not_found(tenant, other_tenant):
    stored = _store(tenant)
    with pytest.raises(NotFoundError):
        MetadataService().get_metadata(stored_file=stored, tenant=other_tenant)
