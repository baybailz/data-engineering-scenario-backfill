-- Transform: decide what each incoming row is. Master data wins: a row whose
-- customer_id already exists in the CRM is a duplicate, otherwise it is new.
-- Within the incoming files the earliest file wins.
{{ config(unique_key='record_key') }}

with master as (
    select customer_id from {{ ref('stg_customer') }}
),

incoming as (
    select * from {{ ref('stg_incoming_customer') }}
),

ranked as (
    select
        incoming.*,
        row_number() over (
            partition by incoming.customer_id
            order by incoming.source_file, incoming.row_num
        ) as arrival_rank,
        master.customer_id is not null as in_master
    from incoming
    left join master on incoming.customer_id = master.customer_id
)

select
    record_key,
    source_file,
    row_num,
    customer_id,
    customer_name,
    city,
    state,
    segment,
    case
        when in_master then 'duplicate_of_master'
        when arrival_rank > 1 then 'duplicate_within_incoming'
        else 'new'
    end as status
from ranked
