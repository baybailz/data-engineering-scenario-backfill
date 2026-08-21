-- Conformed: the store dimension. Small and static; rebuilt in full each
-- run since it never has more than a handful of rows.
{{ config(unique_key='store_key') }}

with stage as (
    select * from {{ ref('stg_store') }}
)

select
    {{ surrogate_key(['stage.store_id']) }} as store_key,
    stage.store_id,
    stage.store_name,
    stage.region,
    current_timestamp as loaded_at,
    current_timestamp as dbt_run_timestamp
from stage
