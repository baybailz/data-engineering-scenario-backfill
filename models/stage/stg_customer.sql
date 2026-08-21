-- Stage: rename and type only. No business logic lives here.
with source as (
    select * from {{ ref('crm_customer') }}
)

select
    customer_id,
    customer_name,
    city,
    state,
    segment,
    'crm_customer' as source
from source
