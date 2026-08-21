-- Master data wins: no imported row may share a customer_id with the CRM.
with master as (
    select customer_id from {{ ref('stg_customer') }}
)

select dim_customer.customer_id
from {{ ref('dim_customer') }}
inner join master on dim_customer.customer_id = master.customer_id
where dim_customer.source <> 'crm_customer'
