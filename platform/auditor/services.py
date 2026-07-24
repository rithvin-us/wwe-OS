"""AuditorService — starts and drains the auditor package pipeline. Same
start()/run_to_completion() pattern automation's run_rule() uses
(Subsystem 1) — no separate execution path.
"""

from __future__ import annotations

from shared.services import BaseService
from workflow.models import PipelineRun
from workflow.services import PipelineService

from auditor.pipelines import AUDITOR_PACKAGE_PIPELINE_KEY


class AuditorService(BaseService):
    def generate_package(self, *, tenant, year: int, month: int, actor=None) -> PipelineRun:
        run, _created = PipelineService().start(
            pipeline_key=AUDITOR_PACKAGE_PIPELINE_KEY,
            tenant=tenant,
            actor=actor,
            trigger_type="manual",
            source_module="auditor",
            source_object_type="BusinessPeriod",
            input_data={"year": year, "month": month},
        )
        return PipelineService().run_to_completion(run, actor=actor)
