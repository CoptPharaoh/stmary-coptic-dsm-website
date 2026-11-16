begin;
-- Effective date chosen for the initial migration: November 15, 2026.
-- Existing rows are never overwritten by rerunning this seed.
insert into public.recurring_event_series
(id,title,weekday,local_start_time,local_end_time,start_date,status) values
('sunday-liturgy','Sunday Divine Liturgy',0,'08:00','11:30','2026-11-15','published'),
('wednesday-liturgy','Wednesday Divine Liturgy',3,'08:00','10:00','2026-11-15','published'),
('deacons-school','Deacons School',6,'18:00',null,'2026-11-15','published'),
('vespers','Vespers',6,'19:00',null,'2026-11-15','published'),
('tasbeha','Midnight Praises (Tasbeha)',6,'20:00',null,'2026-11-15','published')
on conflict(id) do nothing;
insert into public.ministries(name,slug) values
('Parish Administration','parish-administration'),('Sunday School','sunday-school'),
('Deacons School','deacons-school'),('Youth Ministry','youth'),
('Coptic Language','coptic-language'),('Church Media','church-media'),
('Orthodox Digital Library','library') on conflict(slug) do nothing;
commit;

