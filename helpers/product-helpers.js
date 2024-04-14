const { response } = require('express')
const collections = require('../config/collections')
var db = require('../config/connection')

module.exports = {

    addProduct: (product, callback) => {
        console.log(product)
        db.get().collection('product').insertOne(product).then((data)=> {
            callback(data.insertedId)
        })
    },

    getAllProducts: ()=> {
        return new Promise(async (resolve, reject)=> {
            let products = await db.get().collection(collections.PRODUCTS_COLLECTION).find().toArray()
            resolve(products)
        })
    },

    deleteProduct: (prodId)=> {
        return new Promise((resolve, reject) => {
            console.log(prodId)
            db.get().collection(collections.PRODUCTS_COLLECTION).deleteOne({_id:(prodId)}).then((response)=>{
                console.log(response)
                resolve(response)
            })
        })
    },

    getProductDetails: (proId)=> {
        return new Promise((resolve, reject)=>{
            db.get().collection(collections.PRODUCTS_COLLECTION).findOne({_id:proId}).then((product)=>{
                resolve(product)
            })
        })
    },

    updateProduct: (proId, proDetails)=> {
        return new Promise((resolve, reject)=>{
            db.get().collection(collections.PRODUCTS_COLLECTION).updateOne({_id:proId}, {
                $set:{
                    Name:proDetails.Name,
                    Category:proDetails.Category,
                    Description:proDetails.Description,
                    Price:proDetails.Price
                }
            }).then((response)=>{
                resolve()
            })
        })
    }

}
