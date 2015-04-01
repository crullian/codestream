var router = require('express').Router();
var GitHubApi = require('github');
var git = require('gift');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var Repo = mongoose.model('Repo');
var appRoot = require('app-root-path');
var nodeGit = require('nodegit');
var fs = require('fs');
var io = require('socket.io')();
//router.use(session({secret:'The answer to Life, The Universe and Everything: 42'}));
//router.use(passport.initialize());
//router.use(passport.session());
var github = new GitHubApi({
  version: '3.0.0'
});

passport.use(new LocalStrategy(
  function(username, password, done) {
    mongoose.model('User').findOne({ username: username }, function (err, user) {
      console.log('err', err, 'user', user);
      if (err) { return done(err); }
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (!user.correctPassword(password)) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// Github webhook listener
router.post('/repos/:repoId/push', function(req, res) {
  var repoId = req.params.repoId;
  var repoPath = appRoot + '/repos/' + repoId;
  var repo = git(repoPath);
  repo.sync('origin', 'master', function (err) {
    if (err) next(err);
    io.to(repoId).emit('update', "repo updated");
    res.end();
  });
})

// API for CLIve

// POST /login login to server, authenticate user 
router.post('/login', function(req, res) {
  passport.authenticate('local', function(err, user, info) {
    if(err) res.status(500).end();
    else if (!user) {
      console.log('!user', info);
      res.status(401).end();
    } 
    else {
      req.login(user, function(err) {
        if(err) {
          console.log('this err', err);
          res.status(500).end(); 
        }
        else {
          res.status(200).send({user: user});
        }
      });
    }
  })(req, res);
});

router.get("/repos/user/:userId", function (req, res, next) {
  Repo.find({userId: req.params.userId}, function (err, repos) {
    if (err) next(err);
    var repoArray = [];
    repos.forEach(function (repo) {
      repoArray.push(repo.name);
    });
    res.status(200).send(repoArray);
  });
});

router.get("/repos/:repoName", function (req, res, next) {
  Repo.findOne({name: req.params.repoName}, function (err, repo) {
    if (err) next(err);
    res.status(200).send(repo._id);
  });
});

// POST /repos/create Creates a new repo in database, uses POST request data to
//      clone the repo locally and set the app to create a classroom session
//      for it, etc.
router.post('/repos/create', function (req, res, next) {
  var newRepo = new Repo({name: req.body.repository,
                          githubUrl: 'git@github.com:' + req.body.username + "/" + req.body.repository + '.git',
                          userId: req.user._id

  });

  newRepo.createRemote(req.body.repository, req.body.username, req.body.password)
    .then(function (repoInfo) {
      return newRepo.clone(repoInfo, newRepo._id, req.body.username)
    })
    .then(function (repoInfo) {
      return newRepo.addHook(repoInfo, req.body.username, req.body.password)
    })
    .then(function (repoInfo) {
      newRepo.save(function (err) {
        if (err) next('Save Error', err);
        //create a dummy file and push to remote. Allows local to sync with remote
        var repoPath = appRoot + '/repos/' + newRepo._id;
        var filePath = repoPath + '/codestream.txt'
        fs.writeFileSync(filePath, "Auto created by Codestream");
        newRepo.initialCommit(filePath, repoPath)
          .then(function () {
            res.status(200).send({url: repoInfo.ssh_url, repoId: newRepo._id});  
          })
      })
    })
    .catch(function (err) {
      res.status(404).send("Server Error", err);
    })
    .done();
});

module.exports = router;
