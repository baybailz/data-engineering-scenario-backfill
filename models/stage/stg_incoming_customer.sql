-- Stage over the landing table. record_key identifies the incoming row;
-- the customer_id is the natural key we will match on downstream.
with source as (
    select * from {{ ref('incoming_customer') }}
)

select
    source_file || ':' || cast(row_num as varchar) as record_key,
    source_file,
    row_num,
    customer_id,
    customer_name,
    city,
    state,
    segment
from source
