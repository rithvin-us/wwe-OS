from django.urls import path

from metadata.views import StoredFileMetadataView

urlpatterns = [
    path("files/<uuid:file_id>/", StoredFileMetadataView.as_view(), name="metadata-file"),
]
