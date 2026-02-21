CREATE TABLE test_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100)
);

insert into test_table values (1, 'Alice');
select * from test_table;

\d test_table;
Select version();