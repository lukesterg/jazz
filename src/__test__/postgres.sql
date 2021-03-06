drop table if exists savetest3_book;
drop table if exists savetest3_author;
drop table if exists savetest1;
drop table if exists savetest2;
drop table if exists student;
drop table if exists address;
drop table if exists class;

create table class(
  id serial,
  name varchar(200) not null,
  teacher varchar(200) not null,
  funding numeric(6, 4) not null,
  helper varchar(200),
  primary key(id)
);

create table address(
  id serial,
  city varchar(100) not null,
  primary key(id)
);

create table student(
  id serial,
  name varchar(200) not null,
  age int,
  class int references class(id) on delete cascade,
  address int references address(id) on delete cascade,
  primary key(id)
);

create table savetest1 (
  id serial,
  a int,
  primary key(id)
);

create table savetest2 (
  id int,
  a int,
  b int,
  primary key(id)
);

create table savetest3_author (
  id serial,
  name varchar(100),
  primary key(id)
);

create table savetest3_book (
  id serial,
  name varchar(100) not null,
  author int references savetest3_author(id) on delete cascade,
  primary key(id)
);

begin transaction;
insert into class(name, teacher, funding)
values ('Year 3', 'Sam', 10);
insert into class(name, teacher, funding)
values ('Year 4', 'Sam', 20);
insert into class(name, teacher, funding, helper)
values ('Year 5', 'Sally', 30, 'Phil');

insert into address(city)
values('Moil');
insert into address(city)
values('Leanyer');

insert into student(name, age, class, address)
values('Troy', 5, 1, 1);
insert into student(name, age, class, address)
values('Alison', 6, 1, 1);
insert into student(name, age, class, address)
values('Joe', 8, 2, 2);
insert into student(name, age, class)
values('John', 10, 2);

commit transaction;
