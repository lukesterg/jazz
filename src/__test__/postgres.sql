drop table address;
drop table student;
drop table class;

create table class(
  id serial,
  name varchar(200) not null,
  teacher varchar(200) not null,
  funding numeric(6, 4) not null,
  helper varchar(200),
  primary key(id)
);

create table student(
  id serial,
  name varchar(200) not null,
  age int,
  class int references class(id) on delete cascade,
  primary key(id)
);

create table address(
  id serial,
  city varchar(100) not null,
  student_id int references student(id) on delete cascade,
  primary key(id)
);

begin transaction;
insert into class(name, teacher, funding)
values ('Year 3', 'Sam', 10);
insert into class(name, teacher, funding)
values ('Year 4', 'Sam', 20);
insert into class(name, teacher, funding, helper)
values ('Year 5', 'Sally', 30, 'Phil');

insert into student(name, age, class)
values('Troy', 5, 1);
insert into student(name, age, class)
values('Alison', 6, 1);
insert into address(city, student_id)
values('Moil', 1);
insert into address(city, student_id)
values('Leanyer', 1);

insert into student(name, age, class)
values('Joe', 8, 2);
insert into student(name, age, class)
values('John', 10, 2);
insert into address(city, student_id)
values('Moil', 3);
insert into address(city, student_id)
values('Leanyer', 4);

commit transaction;
