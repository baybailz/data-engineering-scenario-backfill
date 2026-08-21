{#
  Surrogate keys. The enterprise convention is md5_number_upper64 on the
  natural key, first column of every dimension, suffixed _key. DuckDB has the
  same function family, so the macro is one line; on Snowflake swap the
  function name and nothing upstream changes.
#}
{% macro surrogate_key(columns) -%}
  md5_number_upper(concat_ws('|', {% for c in columns %}coalesce(cast({{ c }} as varchar), ''){% if not loop.last %}, {% endif %}{% endfor %}))
{%- endmacro %}
