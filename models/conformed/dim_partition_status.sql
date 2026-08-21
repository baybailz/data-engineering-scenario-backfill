-- Conformed: one row per sale_date, refreshed on the same bounded range as
-- fact_sale so the console can show exactly which partitions the last run
-- touched, and which ones are still carrying a bugged total.
{{ config(
    unique_key='sale_date',
    incremental_strategy='delete+insert'
) }}

with trn_sale as (
    select * from {{ ref('trn_tbl_sale') }}
),

by_day as (
    select
        trn_sale.sale_date,
        count(*) as row_count,
        sum(trn_sale.gross_amount) as gross_total,
        sum(trn_sale.net_amount) as net_total
    from trn_sale
    {% if is_incremental() %}
        where
            trn_sale.sale_date between
            cast('{{ var("backfill_start", "1900-01-01") }}' as date)
            and cast('{{ var("backfill_end", "1900-01-01") }}' as date)
    {% endif %}
    group by trn_sale.sale_date
)

select
    by_day.sale_date,
    by_day.row_count,
    by_day.gross_total,
    by_day.net_total,
    by_day.net_total > by_day.gross_total as bugged,
    '{{ var("action_label", "load_next") }}' as built_by_action,
    current_timestamp as last_built_at,
    current_timestamp as dbt_run_timestamp
from by_day
