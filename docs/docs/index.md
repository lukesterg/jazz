# Introduction

Jazz is a simple API to abstract the database layer of your application. Jazz allows your to write your entire application in JavaScript and be able to switch database at any time.

<!-- prettier-ignore -->
!!! warning
    This is a test run of producing output. This project is not complete.

<!-- prettier-ignore -->
!!! info "Jazz currently has a minimal feature set"
    Jazz is currently a Minimum Viable Product (MVP) release. It supports selects, aggregations, relationships, inserts, updates, deletes, etc. however it is not polished.

    The main issues that need to be resolved in this area are:

      * Postgres is currently the only database supported.
      * Model is not validated on save, for instance sending a number to a text field will only get rejected by Postgres not this library.
      * Only one to many relationships are supported. Many to many relations will need to be resolved manually.
      * The SQL schema will need to be created manually.
