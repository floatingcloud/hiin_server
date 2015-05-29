#hiin server description

##:: setting 

```sh
1. install node
2. install npm
3. install mongodb
4. get "hiin_server" using "git clone"
5. npm install in hiin_server folder
6. "/hiin_server/node app" enter!
7. access "http://localhost:3000"
```

cf: bcause current dvelopmental code use "mongodb://loscalhost/test", you cannot do anything for db setting. mongodb initially has test database and don't request any account information fpr localhost access
    



##:: projects folder description 
<pre>
--data : implement databast structure for mongoose
 |
 |- models : implement data model
 |
 |- schemas : implement data structure for models


--routes : routing files collection 
 |-moddleware : implement middleware frequently reusing modules 



--views : view collection writing jade
 |
 |-session : view files for session implement
 |
 |-users : view files for login/user profiles/user list</pre>
