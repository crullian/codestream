'use strict';
var passport = require('passport');
var _ = require('lodash');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var UserModel = mongoose.model('User');

module.exports = function(app) {

    // When passport.authenticate('local') is used, this function will receive
    // the email and password to run the actual authentication logic.
    var strategyFn = function(username, password, done) {
        UserModel.findOne({
            username: username
        }, function(err, user) {
            if (err) return done(err);
            //user.correctPassword is a method from our UserModel schema.
            if (!user || !user.correctPassword(password)) return done(null, false);
            // Properly authenticated.
            done(null, user);
        });
    };

    passport.use(new LocalStrategy({
        usernameField: 'username',
        passwordField: 'password'
    }, strategyFn));

    // A POST /login route is created to handle login.
    app.post('/login', function(req, res, next) {

        var authCb = function(err, user) {

            if (err) return next(err);

            if (!user) {
                var error = new Error('Invalid login credentials');
                error.status = 401;
                return next(error);
            }

            // req.logIn will establish our session.
            req.logIn(user, function(err) {
                if (err) return next(err);
                // We respond with a reponse object that has user with _id and email.
                res.status(200).send({
                    user: _.omit(user.toJSON(), ['password', 'salt'])
                });
            });

        };

        passport.authenticate('local', authCb)(req, res, next);

    });

    app.post('/signup', function(req, res, next) {
        console.log('server signup');
        // var authCb = function(err, user) {
        //     console.log('getting to authCb');
        //     console.log('user is', err);
        //     if (err) return next(err);

        //     if (!user) {
        //         var error = new Error('Invalid login credentials');
        //         error.status = 401;
        //         return next(error);
        //     }

        //     // req.logIn will establish our session.
        //     req.logIn(user, function(err) {
        //         if (err) return next(err);
        //         // We respond with a reponse object that has user with _id and email.
        //         res.status(200).send({
        //             user: _.omit(user.toJSON(), ['password', 'salt'])
        //         });
        //     });

        // };

        UserModel.create(req.body, function(err, user) {
            console.log('getting here? request body', req.body);
            if (err) return next(err);
            res.send({
                id: user._id,
                user: user.username
            });
        });
    });

    // app.get('isAuthenticated') can be used as middleware across your application
    // to control access to specific routes.
    app.setValue('isAuthenticated', function(req, res, next) {
        if (req.user) {
            next(null);
        } else {
            var err = new Error('Request is not authorized.');
            err.status = 401;
            next(err);
        }
    });

};