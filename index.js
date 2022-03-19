/* eslint-disable new-cap */
/* eslint-disable camelcase */
/* eslint-disable no-underscore-dangle */
// importing necessary npm modules
import pg from 'pg';
import express from 'express';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import moment from 'moment';
import jsSHA from 'jssha';

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(cookieParser());

// Override POST requests with query param ?_method=PUT to be PUT requests
app.use(methodOverride('_method'));

const { Pool } = pg;
const port = 3004;
const SALT = 'hedwig';
let commentExist;

// set the way we will connect to the server
const pgConnectionConfigs = {
  user: 'aqifsariman',
  host: 'localhost',
  database: 'birding',
  port: 5432,
};

const pool = new Pool(pgConnectionConfigs);

let visit = 0;

const signUp = (req, res) => {
  const input = req.body;
  res.cookie('username', input.username);
  res.render('signup');
};

const postSignUp = (req, res) => {
  const input = req.body;
  const insertQuery = 'INSERT INTO username (username, password) VALUES ($1, $2)';
  if (input === null || input === undefined) {
    res.render('signup');
  }
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  shaObj.update(input.password);
  const hashedPassword = shaObj.getHash('HEX');
  const values = [input.username, hashedPassword];
  pool.query(insertQuery, values, () => {
    const showQuery = 'SELECT * FROM username';
    pool.query(showQuery, (error, result) => {
      console.log(result.rows);
    });
  });
  res.redirect(301, '/login');
};

const loginPage = (req, res) => {
  res.render('login');
};

const loginDetails = (req, res) => {
  const values = [req.body.username];
  const loginQuery = 'SELECT * FROM username WHERE username=$1';
  pool.query(loginQuery, values, (error, result) => {
    if (error) {
      console.log('Error executing query', error.stack);
      res.status(503).send(result.rows[0]);
      return;
    }

    if (result.rows.length === 0) {
      res.status(403);
      res.cookie('loggedIn', false);
      res.render('login');
      return;
    }

    const user = result.rows[0];
    const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
    shaObj.update(req.body.password);
    const hashedPassword = shaObj.getHash('HEX');

    if (user.password === hashedPassword) {
      const shaObj2 = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });

      const unhashedCookieString = `${user.username}-${SALT}`;
      shaObj2.update(unhashedCookieString);
      const hashedCookieString = shaObj2.getHash('HEX');
      res.cookie('loggedInHash', hashedCookieString);
      res.cookie('username', req.body.username);
      res.cookie('visits', visit);
      res.redirect(301, '/');
      console.log('Login success!');
    } else {
      res.status(403);
      res.redirect(301, '/login');
    }
  });
};

const logout = (req, res) => {
  res.clearCookie('loggedIn');
  res.clearCookie('username');
  visit = 0;
  res.redirect(301, '/login');
};

const homePage = (req, res) => {
  const { loggedInHash, username } = req.cookies;
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  // reconstruct the hashed cookie string
  const unhashedCookieString = `${username}-${SALT}`;
  shaObj.update(unhashedCookieString);
  const hashedCookieString = shaObj.getHash('HEX');
  if (hashedCookieString !== loggedInHash) {
    console.log('Please log in!');
    res.redirect(301, '/login');
  }
  visit += 1;
  res.cookie('visits', visit);
  res.render('home', { username });
};

const getAllNotes = (req, res) => {
  let finalResults;
  const { username } = req.cookies;
  const allNotesQuery = 'SELECT * FROM bird_hunting';
  let sortQuery = 'default';
  const { sort } = req.query;

  console.log('Request came in');
  pool.query(allNotesQuery, (allNotesQueryError, allNotesQueryResult) => {
    if (allNotesQueryError) {
      console.log('Error executing query', allNotesQueryError.stack);
      res.status(503).send(allNotesQueryResult.rows);
      return;
    }
    if (sort === 'date') {
      sortQuery = "SELECT id, habitat, date, appearance, behaviour, vocalisations, flock_size, submitted_by FROM bird_hunting ORDER BY to_date(date, 'Day [,] Month DDth YYYY') ASC;";
      pool.query(sortQuery, (error, results) => {
        finalResults = results.rows;
        res.render('see-note', { finalResults, username });
      });
    } else if (sort === 'habitat') {
      sortQuery = 'SELECT id, habitat, date, appearance, behaviour, vocalisations, flock_size, submitted_by FROM bird_hunting ORDER BY habitat ASC';
      pool.query(sortQuery, (error, results) => {
        finalResults = results.rows;
        res.render('see-note', { finalResults, username });
      });
    } else if (sort === 'behaviour') {
      sortQuery = 'SELECT id, habitat, date, appearance, behaviour, vocalisations, flock_size, submitted_by FROM bird_hunting ORDER BY behaviour ASC';
      pool.query(sortQuery, (error, results) => {
        finalResults = results.rows;
        res.render('see-note', { finalResults, username });
      });
    } else if (sort === 'flock_size') {
      sortQuery = 'SELECT id, habitat, date, appearance, behaviour, vocalisations, flock_size, submitted_by FROM bird_hunting ORDER BY flock_size ASC';
      pool.query(sortQuery, (error, results) => {
        finalResults = results.rows;
        res.render('see-note', { finalResults, username });
      });
    } else if (sort === 'user_submitted') {
      sortQuery = 'SELECT id, habitat, date, appearance, behaviour, vocalisations, flock_size, submitted_by FROM bird_hunting ORDER BY submitted_by ASC';
      pool.query(sortQuery, (error, results) => {
        finalResults = results.rows;
        res.render('see-note', { finalResults, username });
      });
    } else {
      finalResults = allNotesQueryResult.rows;
      res.render('see-note', { finalResults, username });
    }
  });
};

const getNotesForm = (req, res) => {
  const { username } = req.cookies;
  const habitatsQuery = 'SELECT * FROM habitats';
  const behaviourQuery = 'SELECT * FROM behaviours';
  pool.query(habitatsQuery, (habitatsQueryError, habitatsQueryResult) => {
    if (habitatsQueryError) {
      console.log('Error executing query', habitatsQueryError.stack);
      res.status(503).send(habitatsQueryResult.rows);
      return;
    }
    pool.query(behaviourQuery, (behaviourQueryError, behaviourQueryResult) => {
      if (behaviourQueryError) {
        console.log('Error executing query', behaviourQueryError.stack);
        res.status(503).send(behaviourQueryResult.rows);
      }
      const behaviourResults = behaviourQueryResult.rows;
      const habitatsResults = habitatsQueryResult.rows;
      res.render('note', { username, habitatsResults, behaviourResults });
    });
  });
};

const postIntoNotes = (req, res) => {
  const { username } = req.cookies;

  const input = req.body;
  const { date } = req.body;
  console.log(input.behaviour);
  const m = moment(date, moment.HTML5_FMT.DATETIME_LOCAL, ['YYYY-MM-DDTHH:mm']).format(
    'dddd [,] MMMM Do YYYY',
  );

  const allNotesQuery = 'SELECT max(id) FROM bird_hunting';

  const notesQuery = `INSERT INTO bird_hunting (habitat, date, appearance, behaviour, vocalisations, flock_size, submitted_by) VALUES ('${input.habitat}', '${m}', '${input.appearance}', '${input.behaviour}', '${input.vocalisations}', ${input.flock_size}, '${username}') RETURNING id`;

  pool.query(notesQuery, (notesQueryError, notesQueryResult) => {
    if (notesQueryError) {
      console.log('Error executing query', notesQueryError.stack);
      res.status(503).send(notesQueryResult.rows);
      return;
    }

    pool.query(allNotesQuery, (allNotesQueryError, allNotesQueryResult) => {
      const id = allNotesQueryResult.rows[0].max;

      res.redirect(301, `/note/${id}`);
    });
  });
};

const getNotesById = (req, res) => {
  const { username } = req.cookies;
  const { id } = req.params;
  const idQuery = `SELECT * FROM bird_hunting WHERE id=${id}`;
  const submissionQuery = `SELECT submitted_by FROM bird_hunting WHERE id=${id}`;
  const commentsQuery = `SELECT * FROM comments WHERE notes_id = ${id}`;
  pool.query(idQuery, (idQueryError, idQueryResult) => {
    if (idQueryError) {
      console.log('Error executing query', idQueryError.stack);
      res.status(503);
      return;
    }
    pool.query(submissionQuery, (error, result) => {
      pool.query(commentsQuery, (commentsQueryErr, commentsQueryRes) => {
        if (commentsQueryRes.rows.length === 0) {
          commentExist = false;
          console.log(commentExist);
          res.cookie('submittedByCookie', result.rows[0].submitted_by);
          const finalResults = idQueryResult.rows[0];
          res.render('see-note-by-id', {
            finalResults,
            id,
            username,
            commentExist,
          });

          return;
        }
        commentExist = true;
        console.log(commentExist);
        const commentsResult = commentsQueryRes.rows;
        res.cookie('submittedByCookie', result.rows[0].submitted_by);
        const finalResults = idQueryResult.rows[0];
        res.render('see-note-by-id', {
          finalResults,
          id,
          username,
          commentExist,
          commentsResult,
        });
      });
    });
  });
};

const editNotes = (req, res) => {
  const { username } = req.cookies;
  const { id } = req.params;

  const idQuery = `SELECT * FROM bird_hunting WHERE id=${id}`;
  pool.query(idQuery, (idQueryError, idQueryResult) => {
    if (idQueryError) {
      console.log('Error executing query', idQueryError.stack);
      res.status(503);
      return;
    }
    const finalResults = idQueryResult.rows[0];
    res.render('edit-get', { finalResults, id, username });
  });
};

const editNotesPut = (req, res) => {
  const { username } = req.cookies;
  const { id } = req.params;

  const {
    date, habitat, appearance, behaviour, vocalisations, flock_size,
  } = req.body;
  const idQuery = 'UPDATE bird_hunting SET date = $1, habitat = $2, appearance = $3, behaviour = $4, vocalisations = $5, flock_size = $6 WHERE id= $7';
  const allNotesQuery = `SELECT * FROM bird_hunting WHERE id=${id}`;
  pool.query(
    idQuery,
    [date, habitat, appearance, behaviour, vocalisations, flock_size, id],
    (idQueryError, idQueryResult) => {
      if (idQueryError) {
        console.log('Error executing query', idQueryError.stack);
        res.status(503).send(idQueryResult.rows);
        return;
      }
      pool.query(allNotesQuery, (allNotesQueryError, allNotesQueryResult) => {
        if (allNotesQueryError) {
          console.log('Error executing query', allNotesQueryError.stack);
          res.status(503).send(allNotesQueryResult.rows);
          return;
        }

        const finalResults = allNotesQueryResult.rows[0];
        res.render('see-note-by-id', { finalResults, id, username });
      });
    },
  );
};

const deleteNotes = (req, res) => {
  const { id } = req.params;
  const idQuery = `DELETE FROM bird_hunting WHERE id=${id}`;
  pool.query(idQuery, (idQueryError, idQueryResult) => {
    if (idQueryError) {
      console.log('Error executing query', idQueryError.stack);
      res.status(503).send(idQueryResult.rows);
      return;
    }
    res.redirect(301, '/getallnotes');
  });
};

const userNotes = (req, res) => {
  let finalResults;
  const { username } = req.cookies;
  let sortQuery = 'default';
  const { sort } = req.query;
  const commentQuery = `SELECT notes_comments, appearance, notes_id, comments.id FROM bird_hunting INNER JOIN comments ON notes_id = bird_hunting.id WHERE username= '${username}'`;
  const userQuery = `SELECT * FROM bird_hunting WHERE submitted_by='${username}'`;
  pool.query(userQuery, (error, result) => {
    pool.query(commentQuery, (err, commentsResult) => {
      const comments = commentsResult.rows;

      if (sort === 'date') {
        sortQuery = "SELECT id, habitat, date, appearance, behaviour, vocalisations, flock_size, submitted_by FROM bird_hunting ORDER BY to_date(date, 'Day [,] Month DDth YYYY') ASC;";
        pool.query(sortQuery, (err, results) => {
          finalResults = results.rows;
          res.render('user', { finalResults, username, comments });
        });
      } else if (sort === 'habitat') {
        sortQuery = 'SELECT id, habitat, date, appearance, behaviour, vocalisations, flock_size, submitted_by FROM bird_hunting ORDER BY habitat ASC';
        pool.query(sortQuery, (err, results) => {
          finalResults = results.rows;
          res.render('user', { finalResults, username, comments });
        });
      } else if (sort === 'behaviour') {
        sortQuery = 'SELECT id, habitat, date, appearance, behaviour, vocalisations, flock_size, submitted_by FROM bird_hunting ORDER BY behaviour ASC';
        pool.query(sortQuery, (err, results) => {
          finalResults = results.rows;
          res.render('user', { finalResults, username, comments });
        });
      } else if (sort === 'flock_size') {
        sortQuery = 'SELECT id, habitat, date, appearance, behaviour, vocalisations, flock_size, submitted_by FROM bird_hunting ORDER BY flock_size ASC';
        pool.query(sortQuery, (err, results) => {
          finalResults = results.rows;
          res.render('user', { finalResults, username, comments });
        });
      } else if (sort === 'user_submitted') {
        sortQuery = 'SELECT id, habitat, date, appearance, behaviour, vocalisations, flock_size, submitted_by FROM bird_hunting ORDER BY submitted_by ASC';
        pool.query(sortQuery, (err, results) => {
          finalResults = results.rows;
          res.render('user', { finalResults, username, comments });
        });
      } else {
        console.log(comments);
        finalResults = result.rows;
        res.render('user', { finalResults, username, comments });
      }
    });
  });
};

const getSpecies = (req, res) => {
  const { username } = req.cookies;
  res.render('species', { username });
};

const postSpecies = (req, res) => {
  const input = req.body;
  const speciesQuery = `INSERT INTO species (name, scientific_name) VALUES ('${input.species}', '${input.scientific}') RETURNING id`;
  pool.query(speciesQuery, (speciesQueryError, speciesQueryResult) => {
    if (speciesQueryError) {
      console.log('Error executing query', speciesQueryError.stack);
      res.status(503);
    }
    const { id } = speciesQueryResult.rows[0];
    res.redirect(301, `species/${id}`);
  });
};

const getAllSpecies = (req, res) => {
  const { username } = req.cookies;
  let finalResults;
  console.log('Request came in');

  const whenDoneWithQuery = (error, result) => {
    if (error) {
      console.log('Error executing query', error.stack);
      res.status(503).send(result.rows);
      return;
    }
    finalResults = result.rows;
    res.render('species-note', { finalResults, username });
  };

  pool.query('SELECT * FROM species', whenDoneWithQuery);
};

const getSpeciesById = (req, res) => {
  const { username } = req.cookies;
  const { id } = req.params;
  const speciesId = `SELECT * FROM species WHERE id= ${id}`;
  pool.query(speciesId, (speciesIdError, speciesIdResult) => {
    if (speciesIdError) {
      console.log('Error executing query', speciesIdError.stack);
      res.status(503);
      return;
    }
    const finalResults = speciesIdResult.rows[0];
    console.log(finalResults);
    res.cookie('submittedByCookie', username);
    res.render('species-id', { username, id, finalResults });
  });
};

const editSpecies = (req, res) => {
  const { username } = req.cookies;
  const { id } = req.params;
  const idQuery = `SELECT * FROM species WHERE id= ${id}`;
  pool.query(idQuery, (idQueryError, idQueryResult) => {
    if (idQueryError) {
      console.log('Error executing query', idQueryError.stack);
      res.status(503);
    }
    const finalResults = idQueryResult.rows[0];
    res.render('edit-species', { username, finalResults, id });
  });
};

const editSpeciesPut = (req, res) => {
  const { id } = req.params;
  const { username } = req.cookies;
  const { name, scientific_name } = req.body;
  const updateQuery = 'UPDATE bird_hunting SET name = $1, scientific_name = $2 WHERE id= $3';
  const idQuery = `SELECT * FROM species WHERE id= ${id}`;
  pool.query(updateQuery, [name, scientific_name, id], (updateQueryError) => {
    if (updateQueryError) {
      console.log('Error executing query', updateQueryError.stack);
      res.status(503);
    }
    pool.query(idQuery, (idQueryError, idQueryResult) => {
      if (idQueryError) {
        console.log('Error executing query', idQueryError.stack);
        res.status(503);
      }
      const finalResults = idQueryResult.rows[0];
      res.render('species-id', { username, finalResults });
    });
  });
};

const deleteSpecies = (req, res) => {
  const { id } = req.params;
  const deleteQuery = `DELETE FROM species WHERE id=${id}`;
  pool.query(deleteQuery, (deleteQueryError, deleteQueryResult) => {
    if (deleteQueryError) {
      console.log('Error executing query', deleteQueryError.stack);
      res.status(503).send(deleteQueryResult.rows);
      return;
    }
    res.redirect(301, '/species/all');
  });
};

const getBehaviours = (req, res) => {
  const { username } = req.cookies;
  const behaviourQuery = 'SELECT * FROM behaviours';

  let sortQuery = 'default';
  const { sort } = req.query;
  let finalResults;
  pool.query(behaviourQuery, (behaviourQueryError, behaviourQueryResult) => {
    if (behaviourQueryError) {
      console.log('Error executing query', behaviourQueryError);
    }
    if (sort === 'behaviour') {
      sortQuery = 'SELECT name FROM behaviours ORDER BY name ASC';
      pool.query(sortQuery, (error, results) => {
        finalResults = results.rows;
        res.render('behaviours', { finalResults, username });
      });
    } else {
      finalResults = behaviourQueryResult.rows;
      res.render('behaviours', { username, finalResults });
    }
  });
};

const getBehavioursByID = (req, res) => {
  const { username } = req.cookies;
  const { behaviour } = req.params;

  const notesquery = 'SELECT * FROM bird_hunting';
  pool.query(notesquery, (notesQueryError, notesQueryResult) => {
    if (notesQueryError) {
      console.log('Error executing error', notesQueryError);
    }
    const finalResults = [];
    notesQueryResult.rows.forEach((final) => {
      if (final.behaviour.includes(behaviour) === true) {
        finalResults.push(final);
      }
    });
    res.render('notes-by-behaviour', { username, finalResults });
  });
};

const commentsForm = (req, res) => {
  const { username } = req.cookies;
  const { id } = req.params;
  res.render('commentsForm', { username, id });
};

const postComments = (req, res) => {
  const { username } = req.cookies;
  const { id } = req.params;
  const comments = req.body;
  const commentQuery = 'INSERT INTO comments (username, notes_comments, notes_id) VALUES ($1, $2, $3)';
  const values = [username, comments.comments, id];
  pool.query(commentQuery, values, (err) => {
    if (err) {
      commentExist = false;
      res.redirect(301, '/note');
    }
    commentExist = true;
    res.redirect(301, `/note/${id}`);
  });
};

const getComments = (req, res) => {
  const { username } = req.cookies;
  const { id } = req.params;
  const commentsQuery = `SELECT * FROM comments WHERE notes_id=${id}`;
  pool.query(commentsQuery, (err, result) => {
    const finalResults = result.rows;
    res.render('commentsPage', { id, username, finalResults });
  });
};

const editComment = (req, res) => {
  const { username } = req.cookies;
  const { id } = req.params;
  const commentsQuery = `SELECT * FROM comments WHERE id= ${id}`;
  pool.query(commentsQuery, (err, result) => {
    const finalResults = result.rows[0];
    console.log(finalResults);
    res.render('edit-comment', { username, id, finalResults });
  });
};

const editcommentPut = (req, res) => {
  const { id } = req.params;
  const { comments } = req.body;
  const commentQuery = `UPDATE comments SET notes_comments = '${comments}' WHERE id=${id} RETURNING notes_id`;
  pool.query(commentQuery, (err, results) => {
    console.log(results.rows);
    res.redirect(301, `/note/${results.rows[0].notes_id}/comments-all`);
  });
};

const deleteComment = (req, res) => {
  const { id } = req.params;
  const deleteQuery = `DELETE FROM comments WHERE id=${id}`;
  pool.query(deleteQuery, (deleteQueryError, deleteQueryResult) => {
    if (deleteQueryError) {
      console.log('Error executing query', deleteQueryError.stack);
      res.status(503).send(deleteQueryResult.rows);
      return;
    }
    res.redirect(301, `/note/${id}/comments-all`);
  });
};

app.get('/signup', signUp);
app.post('/signup', postSignUp);
app.get('/login', loginPage);
app.post('/login', loginDetails);
app.delete('/logout', logout);
app.get('/', homePage);
app.get('/getallnotes', getAllNotes);
app.get('/note', getNotesForm);
app.post('/note', postIntoNotes);
app.get('/note/:id', getNotesById);
app.delete('/note/:id/delete', deleteNotes);
app.get('/note/:id/edit', editNotes);
app.put('/note/:id/edit', editNotesPut);
app.get('/user/:id', userNotes);
app.get('/species', getSpecies);
app.post('/species', postSpecies);
app.get('/species/all', getAllSpecies);
app.get('/species/:id', getSpeciesById);
app.get('/species/:id/edit', editSpecies);
app.put('/species/:id/edit', editSpeciesPut);
app.delete('/species/:id/delete', deleteSpecies);
app.get('/behaviours', getBehaviours);
app.get('/behaviours/:behaviour', getBehavioursByID);
app.get('/note/:id/comments', commentsForm);
app.get('/note/:id/comments-all', getComments);
app.post('/note/:id/comments', postComments);
app.get('/note/:id/comments/edit', editComment);
app.put('/note/:id/comments/edit', editcommentPut);
app.delete('/note/:id/comments/delete', deleteComment);

app.listen(port, console.log(`Running on port ${port}!`));
