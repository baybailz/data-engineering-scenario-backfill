-- Conformed: the customer dimension, master rows plus imported new rows.
-- Incremental on customer_key so a repeated run upserts instead of
-- duplicating. A reset passes --full-refresh to rebuild from scratch.
{{ config(unique_key='customer_key') }}

with master as (
    select
        customer_id,
        customer_name,
        city,
        state,
        segment,
        source,
        cast(null as varchar) as source_record_key
    from {{ ref('stg_customer') }}
),

imported as (
    select
        customer_id,
        customer_name,
        city,
        state,
        segment,
        source_file || '.csv' as source,
        record_key as source_record_key
    from {{ ref('trn_tbl_customer') }}
    where status = 'new'
),

unioned as (
    select * from master
    union all
    select * from imported
)

select
    {{ surrogate_key(['customer_id']) }} as customer_key,
    customer_id,
    customer_name,
    city,
    state,
    segment,
    source,
    source_record_key,
    current_timestamp as dbt_run_timestamp
from unioned
