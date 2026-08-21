-- Stage: rename and type only. No business logic lives here.
with source as (
    select * from {{ ref('crm_store') }}
)

select
    store_id,
    store_name,
    region
from source
