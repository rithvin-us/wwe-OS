"""Metadata provider registry — register/get/all, same contract as every
other registry in this codebase."""

from __future__ import annotations

import pytest
from metadata.registry import (
    MetadataFields,
    MetadataProviderDef,
    all_metadata_providers,
    get_metadata_provider,
    register_metadata_provider,
)
from shared.exceptions import NotFoundError


def _noop(stored_file) -> MetadataFields:
    return MetadataFields(
        title="x", status="active", business_object_type="X", business_object_id="1"
    )


def test_register_and_get_round_trip():
    definition = MetadataProviderDef(module="test.one", extract=_noop)
    register_metadata_provider(definition)

    fetched = get_metadata_provider("test.one")
    assert fetched.module == "test.one"


def test_get_unregistered_module_raises():
    with pytest.raises(NotFoundError):
        get_metadata_provider("does.not.exist")


def test_register_is_idempotent_by_module():
    def _extract_v1(stored_file):
        return None

    def _extract_v2(stored_file):
        return None

    register_metadata_provider(MetadataProviderDef(module="test.two", extract=_extract_v1))
    register_metadata_provider(MetadataProviderDef(module="test.two", extract=_extract_v2))

    assert get_metadata_provider("test.two").extract is _extract_v2
    assert [d.module for d in all_metadata_providers()].count("test.two") == 1
