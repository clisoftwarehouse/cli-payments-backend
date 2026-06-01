---
inject: true
to: src/modules/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>.service.ts
after: constructor
skip_if: private readonly <%= h.inflection.camelize(type, true) %>Service
---
<% if (kind === 'reference' || kind === 'duplication') { -%>
  private readonly <%= h.inflection.camelize(type, true) %>Service: <%= h.inflection.transform(type, ['pluralize']) %>Service,
<% } -%>