var express = require('express');
var router = express.Router();
var productHelpers = require('../helpers/product-helpers');
const userHelpers = require('../helpers/user-helpers');
const { ObjectId } = require('mongodb');
const { status } = require('express/lib/response');

const verifyLogin = (req, res, next) => {
  if(req.session.userLoggedIn) {
    next()
  } else {
    res.redirect('/login')
  }
}

/* GET home page. */
router.get('/', async function(req, res, next) {

  let user = req.session.user
  console.log(user)

  let cartCount = null
  if(user) {
    cartCount = await userHelpers.getCartCount(user._id)
  }

  productHelpers.getAllProducts().then((products)=>{
    // console.log(products)
    res.render('user/view-products', {products, user, cartCount});
  })
  
});

router.get('/login', (req, res) => {
  if(req.session.user) {
    res.redirect('/')
  } else {
    res.render('user/login', {"loginErr":req.session.userLoginErr})
    req.session.userLoginErr = false
  }
})

router.get('/signup', (req, res) => {
  res.render('user/signup')
})

router.post('/signup', (req, res) => {
  userHelpers.doSignup(req.body).then((response) => {
    console.log(response)
    req.session.user = response
    req.session.user.loggedIn = true
    res.redirect('/')
  })
})

router.post('/login', (req, res) => {
  userHelpers.doLogin(req.body).then((response) => {
    if(response.status) {
      req.session.user = response.user
      req.session.user.loggedIn = true
      res.redirect('/')
    } else {
      req.session.userLoginErr = "Invalid username or password"
      res.redirect('/login')
    }
  })
})

router.get('/logout', (req, res) => {
  req.session.user = null
  req.session.userLoggedIn = false
  res.redirect('/')
})

router.get('/cart', verifyLogin, async (req, res) => {
  let userId = req.session.user._id
  let products = await userHelpers.getCartProducts(userId)
  let totalValue = 0
  if(products.length>0) {
    totalValue = await userHelpers.getTotalAmount(userId)
  }
  
  // console.log(products)
  // console.log(totalValue)
  res.render('user/cart', {products, userId, totalValue})
})

router.get('/add-to-cart/:id', (req, res)=>{
  console.log("api call");
  let proId = new ObjectId(req.params.id)
  let userId = req.session.user._id
  userHelpers.addToCart(proId, userId).then(()=>{
    res.json({status: true})
  })

})

router.post('/change-product-quantity', (req, res, next)=>{

  userHelpers.changeProductQuantity(req.body).then(async(response)=>{
    
    let userId = req.body.user
    response.total = await userHelpers.getTotalAmount(userId)
    res.json(response)
  })
})

router.get('/place-order', verifyLogin,  async (req, res)=>{
  let userId = req.session.user._id
  let total = await userHelpers.getTotalAmount(userId)
  res.render('user/place-order', {total, user:req.session.user})
})

router.post('/place-order', async (req, res)=>{
  let products = await userHelpers.getCartProductList(req.body.userId)
  let totalPrice = await userHelpers.getTotalAmount(req.body.userId)
  userHelpers.placeOrder(req.body, products, totalPrice).then((orderId)=>{
    if(req.body['payment-method'] === 'COD') {
      res.json({codSuccess:true})
    } else {
      userHelpers.generateRazorpay(orderId, totalPrice).then((response)=>{
        res.json(response)
      })
    }
    
  })
  // console.log(req.body)
})

router.get('/order-success', (req, res) =>{
  res.render('user/order-success', {user: req.session.user})
})

router.get('/orders', async (req, res)=>{
  let userId = req.session.user._id
  let orders = await userHelpers.getUserOrders(userId)
  res.render('user/orders', {user: req.session.user, orders, userId})
})

router.get('/view-order-products/:id', async (req, res)=>{
  let orderId = new ObjectId(req.params.id)
  let products = await userHelpers.getOrderProducts(orderId)
  res.render('user/view-order-products', {user: req.session.user, products})
})

router.post('/verify-payment', (req, res)=>{
  userHelpers.verifyPayment(req.body).then(() => {
    userHelpers.changePaymentStatus(req.body.order.receipt).then(()=>{
      // console.log("this"+req.body.order.receipt)
      console.log("Payment successful")
      res.json({status:true})
    })
  }).catch((err)=>{
    console.log(err)
    res.json({status:false, errMsg:''})
  })
})

module.exports = router;
