/* eslint-disable camelcase */
/* eslint-disable no-underscore-dangle */
// importing necessary npm modules
import pg from 'pg';
import express from 'express';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import moment from 'moment';

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(cookieParser());

// Override POST requests with query param ?_method=PUT to be PUT requests
app.use(methodOverride('_method'));

const { Pool } = pg;
const port = 3004;

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
  const insertQuery = `INSERT INTO username (username, password) VALUES ('${input.username}', '${input.password}')`;
  if (input === null || input === undefined) {
    res.render('signup');
  }
  pool.query(insertQuery, () => {
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

  pool.query('SELECT * from username WHERE username=$1', values, (error, result) => {
    if (error) {
      console.log('Error executing query', error.stack);
      res.status(503).send(result.rows);
      return;
    }

    if (result.rows.length === 0) {
      res.status(403);
      res.cookie('loggedIn', false);
      res.render('login');
      return;
    }

    const user = result.rows[0];

    if (user.password === req.body.password) {
      res.cookie('username', req.body.username);
      res.cookie('loggedIn', true);
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
  if (req.cookies.loggedIn === undefined) {
    res.status(403);
    console.log('Please log in!');
    res.redirect(301, '/login');
  } else if (req.cookies.loggedIn === 'true') {
    visit += 1;
    res.cookie('visits', visit);
    const { username } = req.cookies;
    res.render('home', { username });
  }
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
  pool.query(habitatsQuery, (habitatsQueryError, habitatsQueryResult) => {
    if (habitatsQueryError) {
      console.log('Error executing query', habitatsQueryError.stack);
      res.status(503).send(habitatsQueryResult.rows);
      return;
    }
    const habitatsResults = habitatsQueryResult.rows;
    res.render('note', { username, habitatsResults });
  });
};

const postIntoNotes = (req, res) => {
  const { username } = req.cookies;

  const input = req.body;
  const { date } = req.body;
  const m = moment(date, moment.HTML5_FMT.DATETIME_LOCAL, ['YYYY-MM-DDTHH:mm']).format(
    'dddd [,] MMMM Do YYYY',
  );

  const allNotesQuery = 'SELECT max(id) FROM bird_hunting';

  const notesQuery = `INSERT INTO bird_hunting (habitat, date, appearance, behaviour, vocalisations, flock_size, submitted_by) VALUES ('${input.habitat}', '${m}', '${input.appearance}', '${input.behaviour}', '${input.vocalisations}', ${input.flock_size}, '${username}')`;

  pool.query(notesQuery, (notesQueryError, notesQueryResult) => {
    if (notesQueryError) {
      console.log('Error executing query', notesQueryError.stack);
      res.status(503).send(notesQueryResult.rows);
      return;
    }

    pool.query(allNotesQuery, (allNotesQueryError, allNotesQueryResult) => {
      const index = allNotesQueryResult.rows[0].max;

      res.redirect(301, `/note/${index}`);
    });
  });
};

const getNotesById = (req, res) => {
  const { username } = req.cookies;
  const { id } = req.params;
  const idQuery = `SELECT * FROM bird_hunting WHERE id=${id}`;
  const submissionQuery = `SELECT submitted_by FROM bird_hunting WHERE id=${id}`;
  pool.query(idQuery, (idQueryError, idQueryResult) => {
    if (idQueryError) {
      console.log('Error executing query', idQueryError.stack);
      res.status(503);
      return;
    }
    pool.query(submissionQuery, (error, result) => {
      res.cookie('submittedByCookie', result.rows[0].submitted_by);
      const finalResults = idQueryResult.rows[0];
      res.render('see-note-by-id', {
        finalResults,
        id,
        username,
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
  const { username } = req.cookies;
  const userQuery = `SELECT * FROM bird_hunting WHERE submitted_by='${username}'`;
  pool.query(userQuery, (error, result) => {
    const finalResults = result.rows;
    res.render('user', { finalResults, username });
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
  const { username } = req.cookie;
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

app.listen(port, console.log(`Running on port ${port}!`));
