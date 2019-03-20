const Dexterous = require("../../dist/dexterous"),
  dx = new Dexterous();
dx.route("/hello").use(
  () => {
    return {
      value: new Response("at your service!",{status:200}),
      done: true
    };
  }
);
dx.use(
  (value) => {
     const href = value.request.location.href;
     return {value:fetch(href), done:true};
   }
);
dx.listen(self,{events:["fetch"]});