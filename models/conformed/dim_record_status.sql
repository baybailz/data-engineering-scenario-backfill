-- Conformed: the disposition of every incoming record, for the audit trail.
{{ config(unique_key='record_key') }}

select
    record_key,
    source_file,
    row_num,
    customer_id,
    status,
    current_timestamp as dbt_run_timestamp
from {{ ref('trn_tbl_customer') }}
