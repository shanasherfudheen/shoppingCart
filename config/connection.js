var mongoClient = require('mongodb').MongoClient

const state = {
  db:null
}

module.exports.connect = function(done) {
    const url = 'mongodb://127.0.0.1:27017'
    const dbname = 'shoppingCart'

    mongoClient.connect(url).then((data)=>{
      const db = data.db(dbname)
      state.db = db
      done()
    }).catch((err)=>{
      return done(err)
    })
      
}

module.exports.get = function() {
    return state.db
}
    

