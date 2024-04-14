const { response } = require('express')
const collections = require('../config/collections')
var db = require('../config/connection')
const bcrypt = require('bcrypt')
const { ObjectId } = require('mongodb')
const Razorpay = require('razorpay')
const { resolve } = require('path')

var instance = new Razorpay({
    key_id: 'rzp_test_MI0Hg4ZTuu83xa',
    key_secret: 'orDqQdOah1Li1IvfxRkiVVzq',
});


module.exports = {

    doSignup: (userData) => {
        return new Promise(async (resolve, reject) => {
            userData.Password = await bcrypt.hash(userData.Password, 10)
            db.get().collection(collections.USER_COLLECTION).insertOne(userData).then((data) => {
                resolve(userData)
            })
        })
    },

    doLogin: (userData) => {
        return new Promise(async (resolve, reject) => {
            let loginStatus = false
            let response = {}
            let user = await db.get().collection(collections.USER_COLLECTION).findOne({ Email: userData.Email })
            if (user) {
                bcrypt.compare(userData.Password, user.Password).then((status) => {
                    if (status) {
                        console.log("login success")
                        response.user = user
                        response.status = true
                        resolve(response)
                    } else {
                        console.log("login failed")
                        resolve({ status: false })
                    }
                })
            } else {
                console.log("login failed")
                resolve({ status: false })
            }
        })
    },

    addToCart: (prodId, userId) => {
        let proObj = {
            item: prodId,
            quantity: 1
        }
        return new Promise(async (resolve, reject) => {
            let userCart = await db.get().collection(collections.CART_COLLECTION).findOne({ user: userId })
            if (userCart) {
                let proExist = userCart.products.findIndex(product => product.item.toString() == prodId.toString())
                console.log(proExist)
                if (proExist !== -1) {
                    db.get().collection(collections.CART_COLLECTION).updateOne({ user: userId, 'products.item': prodId },
                        {
                            $inc: { 'products.$.quantity': 1 }

                        }).then(() => {
                            resolve()
                        })
                } else {
                    db.get().collection(collections.CART_COLLECTION).updateOne({ user: userId }, {

                        $push: { products: proObj }

                    }).then((response) => {
                        resolve()
                    })
                }

            } else {
                let cartObj = {
                    user: userId,
                    products: [proObj]
                }
                db.get().collection(collections.CART_COLLECTION).insertOne(cartObj).then((response) => {
                    resolve()
                })
            }
        })
    },

    getCartProducts: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cartItems = await db.get().collection(collections.CART_COLLECTION).aggregate([
                {
                    $match: {
                        user: userId
                    }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collections.PRODUCTS_COLLECTION,
                        localField: "item",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                }
            ]).toArray()

            resolve(cartItems)
        })
    },

    getCartCount: (userId) => {
        return new Promise(async (resolve, reject) => {
            let count = 0
            let cart = await db.get().collection(collections.CART_COLLECTION).findOne({ user: userId })
            if (cart) {
                count = cart.products.length
            }
            resolve(count)
        })
    },

    changeProductQuantity: (details) => {
        details.count = parseInt(details.count)
        details.quantity = parseInt(details.quantity)
        let productDetails = new ObjectId(details.product)
        let cartDetails = new ObjectId(details.cart)
        return new Promise((resolve, reject) => {
            if (details.count === -1 && details.quantity === 1) {
                db.get().collection(collections.CART_COLLECTION).updateOne({ _id: cartDetails },
                    {
                        $pull: {
                            products: {
                                item: productDetails
                            }
                        }
                    }).then((response) => {
                        // console.log(response)
                        resolve({ removeProduct: true })

                    })
            } else {
                db.get().collection(collections.CART_COLLECTION).updateOne({ _id: cartDetails, 'products.item': productDetails },
                    {
                        $inc: { 'products.$.quantity': details.count }

                    }).then((response) => {
                        resolve({ status: true })
                    })
            }

        })
    },

    getTotalAmount: (userId) => {

        return new Promise(async (resolve, reject) => {

            // console.log("Iam"+userId)
            let total = await db.get().collection(collections.CART_COLLECTION).aggregate([
                {
                    $match: {
                        user: userId
                    }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collections.PRODUCTS_COLLECTION,
                        localField: "item",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: {
                                $multiply: [{ $toInt: '$quantity' }, { $toInt: '$product.Price' }]
                            }
                        }
                    }
                }
            ]).toArray()
            // console.log(total[0].total)
            resolve(total[0].total)

        })
    },

    placeOrder: (order, products, total) => {
        return new Promise((resolve, reject) => {
            console.log(order, products, total)
            let status = order['payment-method'] === 'COD' ? 'placed' : 'pending'
            let orderObj = {
                deliveryDetails: {
                    mobile: order.mobile,
                    address: order.address,
                    pincode: order.pincode
                },
                userId: order.userId,
                paymentMethod: order['payment-method'],
                products: products,
                totalAmount: total,
                status: status,
                date: new Date()
            }

            db.get().collection(collections.ORDER_COLLECTION).insertOne(orderObj).then((response) => {
                // console.log(orderObj)
                db.get().collection(collections.CART_COLLECTION).deleteOne({ user: order.userId })
                resolve(response.insertedId)
            })
        })
    },

    getCartProductList: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cart = await db.get().collection(collections.CART_COLLECTION).findOne({ user: userId })
            console.log(cart)
            resolve(cart.products)
        })
    },

    getUserOrders: (userId) => {
        return new Promise(async (resolve, reject) => {
            console.log(userId)
            let orders = await db.get().collection(collections.ORDER_COLLECTION).find({userId}).toArray()
            console.log(orders)
            resolve(orders)
        })
    },

    getOrderProducts: (orderId) => {
        return new Promise(async (resolve, reject) => {
            let orderItems = await db.get().collection(collections.ORDER_COLLECTION).aggregate([
                {
                    $match: {
                        _id: orderId
                    }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collections.PRODUCTS_COLLECTION,
                        localField: "item",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                {
                    $project: {
                        item: 1,
                        quantity: 1,
                        product: { $arrayElemAt: ['$product', 0] }
                    }
                },
            ]).toArray()
            console.log(orderItems)
            resolve(orderItems)

        })
    },

    generateRazorpay: (orderId, total) => {
        return new Promise((resolve, reject) => {
            var options = {
                amount: total*100,
                currency: "INR",
                receipt: orderId,
            }

            instance.orders.create(options, function (err, order) {
                console.log("New order:",order)
                resolve(order)
            })


        })
    },

    verifyPayment: (details) => {
        // console.log("Details:"+details)
        return new Promise((resolve, reject)=>{
            const crypto = require('crypto')
            let hmac = crypto.createHmac('sha256', 'orDqQdOah1Li1IvfxRkiVVzq')
            hmac.update(details.payment.razorpay_order_id+'|'+details.payment.razorpay_payment_id)
            hmac = hmac.digest('hex')
            // console.log("hmac"+hmac)
            // console.log(details.payment.razorpay_signature)
            if(hmac === details.payment.razorpay_signature) {
                resolve()
            } else {
                reject()
            }
        })
    },

    changePaymentStatus: (orderId) => {
        console.log("orderid:"+orderId)
        return new Promise((resolve, reject)=>{
            db.get().collection(collections.ORDER_COLLECTION).updateOne({_id: new ObjectId(orderId)},
            {
                $set: {
                    status: 'placed'
                }
            }
            ).then((response)=>{
                // console.log(response)
                resolve()
            })
        })
    }
}