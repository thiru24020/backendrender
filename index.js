const mongoose = require("mongoose");
const express = require("express");
const app = express();
const port = 4000;
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

// Middleware to parse JSON body
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect("mongodb+srv://thiru24020:Pugal%400205@cluster0.xzotg.mongodb.net/myDatabase?retryWrites=true&w=majority")
    .then(() => {
        console.log("Connected to MongoDB Atlas");
    })
    .catch((error) => {
        console.log("Error connecting to MongoDB:", error);
    });

// Multer configuration for image storage
const storage = multer.diskStorage({
    destination: './upload/images',
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });
app.use('/images', express.static('upload/images'));

// Upload image endpoint
app.post("/upload", upload.single('product'), (req, res) => {
    res.json({
        success: 1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`  // Fixed URL formatting
    });
});

// Mongoose Product model schema
const Product = mongoose.model("Product", {
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    available: {
        type: Boolean,
        default: true,
    },
});

// POST route to add a new product
app.post('/addproduct', async (req, res) => {
    try {
        console.log("Request body:", req.body);

        // Destructure and validate properties from req.body
        const { name, image, category, new_price, old_price } = req.body;

        if (!name || !image || !category || new_price === undefined || old_price === undefined) {
            return res.status(400).json({
                success: false,
                message: "All fields (name, image, category, new_price, old_price) are required",
            });
        }

        // Calculate the new ID based on existing products
        const lastProduct = await Product.findOne().sort({ id: -1 }).exec();
        const newId = lastProduct ? lastProduct.id + 1 : 1;

        // Create and save new product
        const product = new Product({
            id: newId,
            name,
            image,
            category,
            new_price,
            old_price,
        });

        await product.save();
        console.log("Product saved:", product);

        res.json({
            success: true,
            message: "Product added successfully",
            product: product,
        });

    } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while adding the product",
            error: error.message,
        });
    }
});

// Remove product endpoint
app.post('/removeproduct', async (req, res) => {
    await Product.findOneAndDelete({ id: req.body.id });
    console.log("Product removed");
    res.json({
        success: true,
        name: req.body.name
    });
});

// Fetch all products endpoint
app.get('/allproducts', async (req, res) => {
    let product = await Product.find({});
    console.log("All Products Fetched");
    res.send(product);
});

// User schema
const Users = mongoose.model('Users', {
    name: {
        type: String,
    },
    email: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
    },
    cartData: {
        type: Object,
    },
    date: {
        type: Date,
        default: Date.now,
    }
});

// Signup route
app.post('/signup', async (req, res) => {
    try {
        let check = await Users.findOne({ email: req.body.email });
        if (check) {
            return res.status(400).json({ success: false, errors: "Existing User Found with email address" });
        }

        let cart = {};
        for (let i = 0; i < 300; i++) {
            cart[i] = 0;
        }

        const user = new Users({
            name: req.body.username,
            email: req.body.email,
            password: req.body.password, // Consider adding password hashing
            cartData: cart,
        });

        await user.save();

        const data = {
            user: {
                id: user.id
            }
        };

        const token = jwt.sign(data, 'secret_ecom');
        res.json({ success: true, token });

    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
});

app.post('/login',async(req,res)=>{
    let user = await Users.findOne({email:req.body.email});
    if (user) {
        const passCompare =req.body.password===user.password;
        if(passCompare){
            const data = {
                user:{
                    id:user.id
                }
            }
            const token = jwt.sign(data,'secret_ecom');
            res.json({success:true,token});
        }
        else{
            res.json({success:false,errors:"Wrong password"});
        }
    }
    else{
        res.json({success:false,errors:"Wrong Email ID"})
    }
})

app.get('/newcollections',async(req,res)=>{
    let products =await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("New Collection fetched");
    res.send(newcollection);
})

app.get('/popularinwomen',async(req,res)=>{
    let products = await Product.find({category:"women"});
    let popular_in_women = products.slice(0,4);
    console.log("Popular in Women Fetched");
    res.send(popular_in_women);

})

const FetchUser = async(req,res,next)=>{
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({errors:"Please authenticate using valid token"})
    }
    else{
        try{
            const data = jwt.verify(token,'secret_ecom');
            req.user = data.user;
            next();
        }catch(error){
            res.status(401).send({error:"Please athenticate useing valid token"})
        }
    }
}

app.post('/addtocart',FetchUser,async (req,res)=>{
    console.log("Added",req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id});
    userData.cartData[req.body.itemId]+=1;
    await Users.findByIdAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Added")
})

app.post('/removefromcart',FetchUser,async(req,res)=>{
    console.log("Removed",req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id});
    if(userData.cartData[req.body.itemId]>0)
    userData.cartData[req.body.itemId]-=1;
    await Users.findByIdAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Removed")
})

app.post('/getcart',FetchUser,async(req,res)=>{
    console.log("GetCart");
    let userData = await Users.findOne({_id:req.user.id});
    res.json(userData.cartData);
})

// Start the server
app.listen(port, (error) => {
    if (!error) {
        console.log("Server Running on Port " + port);
    } else {
        console.log("Error: " + error);
    }
});
