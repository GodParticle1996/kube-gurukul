#!/usr/bin/env bash
# Lab 13 verify — Jobs & CronJobs
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab13
NS=lab13

title "Lab 13 — db-migrate Job"
check "ConfigMap mein TARGET set hai (abhi: '$(jp $NS cm/migrate-config '{.data.TARGET}')')" \
  "logs padho: kubectl -n lab13 logs job/db-migrate — ERROR kya bolta hai?" \
  test -n "$(jp $NS cm/migrate-config '{.data.TARGET}')"
check "db-migrate Job Complete hua (succeeded = 1)" \
  "Config theek karne ke baad bhi Failed? Fail hua Job DOBARA nahi chalta — delete karke phir se apply karo" \
  eq "$(jp $NS job/db-migrate '{.status.succeeded}')" "1"

title "Lab 13 — report CronJob"
cp=$(jp $NS cronjob/report '{.spec.concurrencyPolicy}')
check "Overlapping runs band (concurrencyPolicy: Forbid ya Replace — abhi: ${cp:-?})" \
  "kubectl -n lab13 get jobs -w — ek saath kai 'report-...' Running? Allow = har minute naya, pichla khatam ho ya na ho" \
  test "$cp" = "Forbid" -o "$cp" = "Replace"
ad=$(jp $NS cronjob/report '{.spec.jobTemplate.spec.activeDeadlineSeconds}')
check "Har report run ki time-limit hai (activeDeadlineSeconds — abhi: ${ad:-nahi})" \
  "atki hui report hamesha chalti rahegi aur Forbid ki wajah se AGLI saari runs skip hongi! jobTemplate.spec.activeDeadlineSeconds do" \
  ge "${ad:-0}" 1

summary
